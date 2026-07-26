import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { generateCampCode } from "../utils/code";
import { isDueOnDate, toDayStart } from "../utils/recurrence";

const router = Router();
router.use(requireAuth);

const createCampSchema = z.object({
  name: z.string().min(1, "Le nom du camp est requis."),
  description: z.string().max(500).optional().nullable(),
  exerciseIds: z.array(z.string()).min(1, "Selectionne au moins un exercice."),
  startDate: z.string().optional().nullable(), // format ISO "YYYY-MM-DD"
  endDate: z.string().optional().nullable(),
});

// Cree un camp : choix d'un ensemble d'exercices, generation d'un code d'invitation.
// Le createur devient automatiquement membre du camp.
router.post("/", async (req: AuthRequest, res) => {
  const parsed = createCampSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { name, description, exerciseIds, startDate, endDate } = parsed.data;

  if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
    return res.status(400).json({ error: "La date de fin doit etre apres la date de debut." });
  }

  // On genere un code unique (tres faible probabilite de collision, on retente si besoin)
  let code = generateCampCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const clash = await prisma.camp.findUnique({ where: { code } });
    if (!clash) break;
    code = generateCampCode();
  }

  const camp = await prisma.camp.create({
    data: {
      name,
      description: description || null,
      code,
      createdById: req.userId!,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      exercises: { create: exerciseIds.map((exerciseId) => ({ exerciseId })) },
      members: { create: [{ userId: req.userId! }] },
    },
    include: { exercises: { include: { exercise: true } }, members: true },
  });

  res.status(201).json(camp);
});

const joinSchema = z.object({ code: z.string().min(1) });

// Rejoint un camp existant via son code d'invitation
router.post("/join", async (req: AuthRequest, res) => {
  const parsed = joinSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Code requis." });
  }
  const code = parsed.data.code.trim().toUpperCase();

  const camp = await prisma.camp.findUnique({ where: { code } });
  if (!camp) {
    return res.status(404).json({ error: "Aucun camp ne correspond a ce code." });
  }

  const existing = await prisma.campMembership.findUnique({
    where: { userId_campId: { userId: req.userId!, campId: camp.id } },
  });
  if (existing) {
    return res.status(200).json({ message: "Tu es deja membre de ce camp.", campId: camp.id });
  }

  await prisma.campMembership.create({ data: { userId: req.userId!, campId: camp.id } });
  res.status(201).json({ message: `Bienvenue dans le camp "${camp.name}" !`, campId: camp.id });
});

// Liste les camps dont l'utilisateur est membre
router.get("/mine", async (req: AuthRequest, res) => {
  const memberships = await prisma.campMembership.findMany({
    where: { userId: req.userId },
    include: {
      camp: {
        include: {
          exercises: { include: { exercise: true } },
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });
  res.json(memberships.map((m) => m.camp));
});

// Detail d'un camp (verifie que l'utilisateur en est bien membre)
router.get("/:id", async (req: AuthRequest, res) => {
  const membership = await prisma.campMembership.findUnique({
    where: { userId_campId: { userId: req.userId!, campId: req.params.id } },
  });
  if (!membership) {
    return res.status(403).json({ error: "Tu n'es pas membre de ce camp." });
  }

  const camp = await prisma.camp.findUnique({
    where: { id: req.params.id },
    include: {
      exercises: { include: { exercise: true } },
      circuits: true,
      members: { include: { user: { select: { id: true, name: true } } } },
    },
  });
  if (!camp) return res.status(404).json({ error: "Camp introuvable." });
  res.json(camp);
});

const updateCampSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().max(500).optional().nullable(),
});

// Modifie le nom/descriptif d'un camp : reserve au createur du camp
router.put("/:id", async (req: AuthRequest, res) => {
  const camp = await prisma.camp.findUnique({ where: { id: req.params.id } });
  if (!camp) return res.status(404).json({ error: "Camp introuvable." });
  if (camp.createdById !== req.userId) {
    return res.status(403).json({ error: "Seul le createur du camp peut le modifier." });
  }

  const parsed = updateCampSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const updated = await prisma.camp.update({
    where: { id: req.params.id },
    data: parsed.data,
  });
  res.json(updated);
});

// Supprime definitivement un camp : reserve au createur du camp.
// Supprime aussi en cascade les exercices du camp, les adhesions, les logs et les messages associes.
router.delete("/:id", async (req: AuthRequest, res) => {
  const camp = await prisma.camp.findUnique({ where: { id: req.params.id } });
  if (!camp) return res.status(404).json({ error: "Camp introuvable." });
  if (camp.createdById !== req.userId) {
    return res.status(403).json({ error: "Seul le createur du camp peut le supprimer." });
  }

  await prisma.camp.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// Classement des membres du camp base UNIQUEMENT sur leur regularite personnelle
// (taux de seances realisees par rapport aux seances dues, et jours consecutifs) --
// jamais sur les performances (poids, repetitions, etc.).
router.get("/:id/leaderboard", async (req: AuthRequest, res) => {
  const campId = req.params.id;
  const membership = await prisma.campMembership.findUnique({
    where: { userId_campId: { userId: req.userId!, campId } },
  });
  if (!membership) return res.status(403).json({ error: "Tu n'es pas membre de ce camp." });

  const camp = await prisma.camp.findUnique({
    where: { id: campId },
    include: {
      exercises: true,
      members: { include: { user: { select: { id: true, name: true } } } },
    },
  });
  if (!camp) return res.status(404).json({ error: "Camp introuvable." });

  const today = toDayStart(new Date());
  const results = [];

  for (const member of camp.members) {
    const logs = await prisma.exerciseLog.findMany({
      where: { userId: member.userId, campId },
      select: { date: true },
    });
    const completedDates = new Set(logs.map((l) => l.date.toISOString().slice(0, 10)));

    let dueCount = 0;
    let doneCount = 0;
    for (const ce of camp.exercises) {
      const effectiveStart = toDayStart(
        new Date(Math.max(new Date(ce.startDate).getTime(), new Date(member.joinedAt).getTime()))
      );
      const cursor = new Date(effectiveStart);
      while (cursor.getTime() <= today.getTime()) {
        if (isDueOnDate(ce, cursor)) {
          dueCount++;
          if (completedDates.has(cursor.toISOString().slice(0, 10))) doneCount++;
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }
    const regularityRate = dueCount > 0 ? Math.round((doneCount / dueCount) * 100) : 0;

    // Streak propre a ce camp : jours consecutifs (en remontant depuis aujourd'hui/hier)
    // avec au moins une seance validee dans ce camp.
    let streak = 0;
    const cursor2 = toDayStart(today);
    if (!completedDates.has(cursor2.toISOString().slice(0, 10))) {
      cursor2.setUTCDate(cursor2.getUTCDate() - 1);
    }
    for (let i = 0; i < 3650; i++) {
      const key = cursor2.toISOString().slice(0, 10);
      if (!completedDates.has(key)) break;
      streak++;
      cursor2.setUTCDate(cursor2.getUTCDate() - 1);
    }

    results.push({
      userId: member.userId,
      name: member.user.name,
      regularityRate,
      streak,
      dueCount,
      doneCount,
    });
  }

  results.sort((a, b) => b.regularityRate - a.regularityRate || b.streak - a.streak);
  res.json(results);
});

export default router;
