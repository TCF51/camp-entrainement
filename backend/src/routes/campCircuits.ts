import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { toDayStart } from "../utils/recurrence";
import { checkAndAwardBadges } from "../utils/badges";
import { notifyUser } from "../services/notifications";

const router = Router();
router.use(requireAuth);

const recurrenceSchema = z.discriminatedUnion("recurrenceType", [
  z.object({ recurrenceType: z.literal("DAILY") }),
  z.object({ recurrenceType: z.literal("WEEKLY"), daysOfWeek: z.array(z.number().min(0).max(6)).min(1) }),
  z.object({ recurrenceType: z.literal("EVERY_N_DAYS"), intervalDays: z.number().min(1) }),
  z.object({ recurrenceType: z.literal("WEEKLY_COUNT"), timesPerWeek: z.number().min(1).max(7) }),
]);

const circuitSchema = z
  .object({
    campId: z.string(),
    name: z.string().min(1, "Le nom du circuit est requis."),
    description: z.string().max(500).optional().nullable(),
    items: z.array(z.object({ exerciseId: z.string().optional(), name: z.string().min(1) })).min(1, "Ajoute au moins un exercice au circuit."),
    workSeconds: z.number().min(5),
    restSeconds: z.number().min(0),
    rounds: z.number().min(1),
    roundRestSeconds: z.number().min(0),
  })
  .and(recurrenceSchema);

async function assertCoach(userId: string, campId: string) {
  const camp = await prisma.camp.findUnique({ where: { id: campId } });
  if (!camp) return { ok: false as const, status: 404, error: "Camp introuvable." };
  if (camp.createdById !== userId) {
    return { ok: false as const, status: 403, error: "Seul le créateur du camp peut définir les circuits." };
  }
  return { ok: true as const, campName: camp.name };
}

async function notifyOtherMembers(campId: string, exceptUserId: string, campName: string, message: string) {
  const others = await prisma.campMembership.findMany({ where: { campId, userId: { not: exceptUserId } } });
  for (const m of others) {
    notifyUser(m.userId, "CAMP_UPDATED", `📋 ${campName}`, message, `/camps/${campId}`).catch(() => {});
  }
}

// Créé un circuit training pour un camp : réservé au créateur du camp
router.post("/", async (req: AuthRequest, res) => {
  const parsed = circuitSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const data = parsed.data;

  const check = await assertCoach(req.userId!, data.campId);
  if (!check.ok) return res.status(check.status).json({ error: check.error });

  const circuit = await prisma.campCircuit.create({
    data: {
      campId: data.campId,
      name: data.name,
      description: data.description ?? null,
      items: JSON.stringify(data.items),
      workSeconds: data.workSeconds,
      restSeconds: data.restSeconds,
      rounds: data.rounds,
      roundRestSeconds: data.roundRestSeconds,
      recurrenceType: data.recurrenceType,
      daysOfWeek: data.recurrenceType === "WEEKLY" ? JSON.stringify(data.daysOfWeek) : null,
      intervalDays: data.recurrenceType === "EVERY_N_DAYS" ? data.intervalDays : null,
      timesPerWeek: data.recurrenceType === "WEEKLY_COUNT" ? data.timesPerWeek : null,
    },
  });

  notifyOtherMembers(data.campId, req.userId!, check.campName, `Nouveau circuit "${circuit.name}" ajoute.`);

  res.status(201).json(circuit);
});

// Modifie un circuit existant : réservé au créateur du camp
router.put("/:id", async (req: AuthRequest, res) => {
  const existing = await prisma.campCircuit.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Circuit introuvable." });

  const parsed = circuitSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const data = parsed.data;

  const check = await assertCoach(req.userId!, data.campId);
  if (!check.ok) return res.status(check.status).json({ error: check.error });

  const circuit = await prisma.campCircuit.update({
    where: { id: req.params.id },
    data: {
      name: data.name,
      description: data.description ?? null,
      items: JSON.stringify(data.items),
      workSeconds: data.workSeconds,
      restSeconds: data.restSeconds,
      rounds: data.rounds,
      roundRestSeconds: data.roundRestSeconds,
      recurrenceType: data.recurrenceType,
      daysOfWeek: data.recurrenceType === "WEEKLY" ? JSON.stringify(data.daysOfWeek) : null,
      intervalDays: data.recurrenceType === "EVERY_N_DAYS" ? data.intervalDays : null,
      timesPerWeek: data.recurrenceType === "WEEKLY_COUNT" ? data.timesPerWeek : null,
    },
  });

  notifyOtherMembers(data.campId, req.userId!, check.campName, `Le circuit "${circuit.name}" a ete modifie.`);

  res.json(circuit);
});

// Supprime un circuit : réservé au créateur du camp
router.delete("/:id", async (req: AuthRequest, res) => {
  const existing = await prisma.campCircuit.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Circuit introuvable." });

  const check = await assertCoach(req.userId!, existing.campId);
  if (!check.ok) return res.status(check.status).json({ error: check.error });

  await prisma.campCircuit.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

const logSchema = z.object({ durationSeconds: z.number().min(0) });

// Valide la réalisation d'un circuit de camp pour aujourd'hui (accessible à tout membre du camp)
router.post("/:id/log", async (req: AuthRequest, res) => {
  const circuit = await prisma.campCircuit.findUnique({ where: { id: req.params.id } });
  if (!circuit) return res.status(404).json({ error: "Circuit introuvable." });

  const membership = await prisma.campMembership.findUnique({
    where: { userId_campId: { userId: req.userId!, campId: circuit.campId } },
  });
  if (!membership) return res.status(403).json({ error: "Tu n'es pas membre de ce camp." });

  const parsed = logSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Durée invalide." });
  }

  const day = toDayStart(new Date());
  const log = await prisma.campCircuitLog.upsert({
    where: { userId_campCircuitId_date: { userId: req.userId!, campCircuitId: circuit.id, date: day } },
    create: {
      userId: req.userId!,
      campCircuitId: circuit.id,
      campId: circuit.campId,
      date: day,
      durationSeconds: parsed.data.durationSeconds,
      completed: true,
    },
    update: { durationSeconds: parsed.data.durationSeconds, completed: true },
  });

  const newBadges = await checkAndAwardBadges(req.userId!);
  res.status(201).json({ log, newBadges });
});

export default router;
