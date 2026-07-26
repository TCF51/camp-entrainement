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
    const restDays = await prisma.restDay.findMany({ where: { userId: member.userId }, select: { date: true } });
    const restDates = new Set(restDays.map((r) => r.date.toISOString().slice(0, 10)));

    let dueCount = 0;
    let doneCount = 0;
    for (const ce of camp.exercises) {
      const effectiveStart = toDayStart(
        new Date(Math.max(new Date(ce.startDate).getTime(), new Date(member.joinedAt).getTime()))
      );
      const cursor = new Date(effectiveStart);
      while (cursor.getTime() <= today.getTime()) {
        const key = cursor.toISOString().slice(0, 10);
        if (!restDates.has(key) && isDueOnDate(ce, cursor)) {
          dueCount++;
          if (completedDates.has(key)) doneCount++;
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }
    const regularityRate = dueCount > 0 ? Math.round((doneCount / dueCount) * 100) : 0;

    // Streak propre a ce camp : jours consecutifs (en remontant depuis aujourd'hui/hier)
    // avec au moins une seance validee dans ce camp. Les jours de repos justifie sont neutres.
    let streak = 0;
    const cursor2 = toDayStart(today);
    if (!completedDates.has(cursor2.toISOString().slice(0, 10)) && !restDates.has(cursor2.toISOString().slice(0, 10))) {
      cursor2.setUTCDate(cursor2.getUTCDate() - 1);
    }
    for (let i = 0; i < 3650; i++) {
      const key = cursor2.toISOString().slice(0, 10);
      if (restDates.has(key)) {
        cursor2.setUTCDate(cursor2.getUTCDate() - 1);
        continue;
      }
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

// Duplique un camp (nom, descriptif, exercices et circuits avec leurs consignes) pour
// relancer une nouvelle "saison" sans tout reconfigurer. Reserve au createur du camp.
// Les membres, l'historique et les messages ne sont PAS copies.
router.post("/:id/duplicate", async (req: AuthRequest, res) => {
  const original = await prisma.camp.findUnique({
    where: { id: req.params.id },
    include: { exercises: true, circuits: true },
  });
  if (!original) return res.status(404).json({ error: "Camp introuvable." });
  if (original.createdById !== req.userId) {
    return res.status(403).json({ error: "Seul le createur du camp peut le dupliquer." });
  }

  let code = generateCampCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const clash = await prisma.camp.findUnique({ where: { code } });
    if (!clash) break;
    code = generateCampCode();
  }

  const duplicate = await prisma.camp.create({
    data: {
      name: `${original.name} (copie)`,
      description: original.description,
      code,
      createdById: req.userId!,
      exercises: {
        create: original.exercises.map((ce) => ({
          exerciseId: ce.exerciseId,
          description: ce.description,
          targetSets: ce.targetSets,
          targetMode: ce.targetMode,
          targetValue: ce.targetValue,
          recurrenceType: ce.recurrenceType,
          daysOfWeek: ce.daysOfWeek,
          intervalDays: ce.intervalDays,
        })),
      },
      circuits: {
        create: original.circuits.map((c) => ({
          name: c.name,
          description: c.description,
          items: c.items,
          workSeconds: c.workSeconds,
          restSeconds: c.restSeconds,
          rounds: c.rounds,
          roundRestSeconds: c.roundRestSeconds,
          recurrenceType: c.recurrenceType,
          daysOfWeek: c.daysOfWeek,
          intervalDays: c.intervalDays,
        })),
      },
      members: { create: [{ userId: req.userId! }] },
    },
  });

  res.status(201).json(duplicate);
});

// Vue calendrier d'un mois pour l'utilisateur courant : pour chaque jour, etait-ce du
// (au moins un exercice/circuit du camp) et a-t-il ete fait (au moins un valide) ?
router.get("/:id/calendar", async (req: AuthRequest, res) => {
  const campId = req.params.id;
  const membership = await prisma.campMembership.findUnique({
    where: { userId_campId: { userId: req.userId!, campId } },
  });
  if (!membership) return res.status(403).json({ error: "Tu n'es pas membre de ce camp." });

  const monthParam = (req.query.month as string) || new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const [yearStr, monthStr] = monthParam.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr); // 1-12

  const camp = await prisma.camp.findUnique({
    where: { id: campId },
    include: { exercises: true, circuits: true },
  });
  if (!camp) return res.status(404).json({ error: "Camp introuvable." });

  const [logs, circuitLogs, restDays] = await Promise.all([
    prisma.exerciseLog.findMany({ where: { userId: req.userId, campId }, select: { date: true } }),
    prisma.campCircuitLog.findMany({ where: { userId: req.userId, campId }, select: { date: true } }),
    prisma.restDay.findMany({ where: { userId: req.userId }, select: { date: true } }),
  ]);
  const doneDates = new Set([
    ...logs.map((l) => l.date.toISOString().slice(0, 10)),
    ...circuitLogs.map((l) => l.date.toISOString().slice(0, 10)),
  ]);
  const restDates = new Set(restDays.map((r) => r.date.toISOString().slice(0, 10)));

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(Date.UTC(year, month - 1, d));
    const key = date.toISOString().slice(0, 10);
    const due =
      (camp.startDate ? date.getTime() >= toDayStart(camp.startDate).getTime() : true) &&
      (camp.endDate ? date.getTime() <= toDayStart(camp.endDate).getTime() : true) &&
      (camp.exercises.some((ce) => isDueOnDate(ce, date)) || camp.circuits.some((c) => isDueOnDate(c, date)));
    days.push({
      date: key,
      due,
      done: doneDates.has(key),
      rest: restDates.has(key),
    });
  }

  res.json({ month: monthParam, days });
});

// Fil d'activite du camp : dernieres seances validees par tous les membres (avec reactions),
// pour s'encourager sans se comparer sur la performance.
router.get("/:id/feed", async (req: AuthRequest, res) => {
  const campId = req.params.id;
  const membership = await prisma.campMembership.findUnique({
    where: { userId_campId: { userId: req.userId!, campId } },
  });
  if (!membership) return res.status(403).json({ error: "Tu n'es pas membre de ce camp." });

  const [logs, circuitLogs] = await Promise.all([
    prisma.exerciseLog.findMany({
      where: { campId },
      include: { user: { select: { id: true, name: true } }, exercise: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.campCircuitLog.findMany({
      where: { campId },
      include: { user: { select: { id: true, name: true } }, campCircuit: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  const feedItemsRaw = [
    ...logs.map((l) => ({
      targetType: "exercise" as const,
      targetId: l.id,
      userId: l.user.id,
      userName: l.user.name,
      label: l.exercise.name,
      date: l.date.toISOString(),
      createdAt: l.createdAt,
    })),
    ...circuitLogs.map((l) => ({
      targetType: "circuit" as const,
      targetId: l.id,
      userId: l.user.id,
      userName: l.user.name,
      label: l.campCircuit.name,
      date: l.date.toISOString(),
      createdAt: l.createdAt,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 30);

  const reactions = await prisma.reaction.findMany({
    where: {
      OR: feedItemsRaw.map((i) => ({ targetType: i.targetType, targetId: i.targetId })),
    },
  });

  const feedItems = feedItemsRaw.map((item) => {
    const itemReactions = reactions.filter((r) => r.targetType === item.targetType && r.targetId === item.targetId);
    const byType = new Map<string, { count: number; reactedByMe: boolean }>();
    for (const r of itemReactions) {
      const entry = byType.get(r.type) ?? { count: 0, reactedByMe: false };
      entry.count++;
      if (r.userId === req.userId) entry.reactedByMe = true;
      byType.set(r.type, entry);
    }
    return {
      ...item,
      reactions: [...byType.entries()].map(([type, v]) => ({ type, ...v })),
    };
  });

  res.json(feedItems);
});

export default router;
