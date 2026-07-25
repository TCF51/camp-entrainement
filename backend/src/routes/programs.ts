import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const recurrenceSchema = z.discriminatedUnion("recurrenceType", [
  z.object({ recurrenceType: z.literal("DAILY") }),
  z.object({ recurrenceType: z.literal("WEEKLY"), daysOfWeek: z.array(z.number().min(0).max(6)).min(1) }),
  z.object({ recurrenceType: z.literal("EVERY_N_DAYS"), intervalDays: z.number().min(1) }),
]);

const targetSchema = z.discriminatedUnion("targetMode", [
  z.object({ targetMode: z.literal("FIXED"), targetValue: z.number().min(1) }),
  z.object({ targetMode: z.literal("MAX"), targetValue: z.number().min(1).optional() }),
]);

const upsertSchema = z
  .object({
    campId: z.string(),
    exerciseId: z.string(),
    targetSets: z.number().min(1),
  })
  .and(targetSchema)
  .and(recurrenceSchema);

// Cree ou met a jour le programme personnel d'un utilisateur pour un exercice donne d'un camp
router.post("/", async (req: AuthRequest, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const data = parsed.data;

  // Verifie que l'utilisateur est bien membre du camp, et que l'exercice en fait partie
  const membership = await prisma.campMembership.findUnique({
    where: { userId_campId: { userId: req.userId!, campId: data.campId } },
  });
  if (!membership) return res.status(403).json({ error: "Tu n'es pas membre de ce camp." });

  const campExercise = await prisma.campExercise.findUnique({
    where: { campId_exerciseId: { campId: data.campId, exerciseId: data.exerciseId } },
  });
  if (!campExercise) return res.status(400).json({ error: "Cet exercice ne fait pas partie du camp." });

  const program = await prisma.userProgram.upsert({
    where: {
      userId_campId_exerciseId: { userId: req.userId!, campId: data.campId, exerciseId: data.exerciseId },
    },
    create: {
      userId: req.userId!,
      campId: data.campId,
      exerciseId: data.exerciseId,
      targetSets: data.targetSets,
      targetMode: data.targetMode,
      targetValue: data.targetMode === "FIXED" ? data.targetValue : data.targetValue ?? null,
      recurrenceType: data.recurrenceType,
      daysOfWeek: data.recurrenceType === "WEEKLY" ? JSON.stringify(data.daysOfWeek) : null,
      intervalDays: data.recurrenceType === "EVERY_N_DAYS" ? data.intervalDays : null,
    },
    update: {
      targetSets: data.targetSets,
      targetMode: data.targetMode,
      targetValue: data.targetMode === "FIXED" ? data.targetValue : data.targetValue ?? null,
      recurrenceType: data.recurrenceType,
      daysOfWeek: data.recurrenceType === "WEEKLY" ? JSON.stringify(data.daysOfWeek) : null,
      intervalDays: data.recurrenceType === "EVERY_N_DAYS" ? data.intervalDays : null,
      active: true,
    },
  });

  res.status(201).json(program);
});

// Liste les programmes de l'utilisateur pour un camp donne
router.get("/", async (req: AuthRequest, res) => {
  const campId = req.query.campId as string | undefined;
  if (!campId) return res.status(400).json({ error: "Le parametre campId est requis." });

  const programs = await prisma.userProgram.findMany({
    where: { userId: req.userId, campId, active: true },
    include: { exercise: true },
  });
  res.json(programs);
});

// Desactive un programme (l'utilisateur arrete de suivre cet exercice dans ce camp)
router.delete("/:id", async (req: AuthRequest, res) => {
  const program = await prisma.userProgram.findUnique({ where: { id: req.params.id } });
  if (!program || program.userId !== req.userId) {
    return res.status(404).json({ error: "Programme introuvable." });
  }
  await prisma.userProgram.update({ where: { id: req.params.id }, data: { active: false } });
  res.status(204).send();
});

export default router;
