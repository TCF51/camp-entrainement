import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { computeStreak, isDueOnDate, toDayStart } from "../utils/recurrence";

const router = Router();
router.use(requireAuth);

// Historique + serie de regularite (streak) pour un exercice donne dans un camp.
// La consigne (recurrence, objectif) est celle definie par le createur du camp ;
// l'historique et le streak restent propres a chaque utilisateur.
router.get("/exercise", async (req: AuthRequest, res) => {
  const campId = req.query.campId as string;
  const exerciseId = req.query.exerciseId as string;
  if (!campId || !exerciseId) {
    return res.status(400).json({ error: "campId et exerciseId sont requis." });
  }

  const membership = await prisma.campMembership.findUnique({
    where: { userId_campId: { userId: req.userId!, campId } },
  });
  if (!membership) return res.status(403).json({ error: "Tu n'es pas membre de ce camp." });

  const campExercise = await prisma.campExercise.findUnique({
    where: { campId_exerciseId: { campId, exerciseId } },
  });
  if (!campExercise) return res.status(404).json({ error: "Cet exercice ne fait pas partie du camp." });

  const logs = await prisma.exerciseLog.findMany({
    where: { userId: req.userId, campId, exerciseId },
    orderBy: { date: "asc" },
  });
  const restDays = await prisma.restDay.findMany({ where: { userId: req.userId } });
  const restDates = new Set(restDays.map((r) => r.date.toISOString().slice(0, 10)));

  const completedDates = new Set(logs.map((l) => l.date.toISOString().slice(0, 10)));
  const streak = computeStreak(campExercise, completedDates, new Date(), restDates);

  // Taux de regularite depuis le debut de la consigne : jours dus vs jours reussis
  // (les jours de repos justifie ne comptent pas comme "dus")
  const today = toDayStart(new Date());
  let dueCount = 0;
  let doneCount = 0;
  const cursor = toDayStart(campExercise.startDate);
  while (cursor.getTime() <= today.getTime()) {
    const key = cursor.toISOString().slice(0, 10);
    if (!restDates.has(key) && isDueOnDate(campExercise, cursor)) {
      dueCount++;
      if (completedDates.has(key)) doneCount++;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const regularityRate = dueCount > 0 ? Math.round((doneCount / dueCount) * 100) : 0;

  res.json({
    program: campExercise,
    history: logs.map((l) => ({
      date: l.date.toISOString().slice(0, 10),
      setsDone: l.setsDone,
      valueDone: l.valueDone,
    })),
    streak,
    dueCount,
    doneCount,
    regularityRate,
  });
});

export default router;
