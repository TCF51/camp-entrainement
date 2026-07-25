import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { computeStreak, isDueOnDate, toDayStart } from "../utils/recurrence";

const router = Router();
router.use(requireAuth);

// Historique + serie de regularite (streak) pour un exercice donne dans un camp.
// Sert a alimenter le graphique de progression.
router.get("/exercise", async (req: AuthRequest, res) => {
  const campId = req.query.campId as string;
  const exerciseId = req.query.exerciseId as string;
  if (!campId || !exerciseId) {
    return res.status(400).json({ error: "campId et exerciseId sont requis." });
  }

  const program = await prisma.userProgram.findUnique({
    where: { userId_campId_exerciseId: { userId: req.userId!, campId, exerciseId } },
  });
  if (!program) return res.status(404).json({ error: "Aucun programme trouve pour cet exercice." });

  const logs = await prisma.exerciseLog.findMany({
    where: { userId: req.userId, campId, exerciseId },
    orderBy: { date: "asc" },
  });

  const completedDates = new Set(logs.map((l) => l.date.toISOString().slice(0, 10)));
  const streak = computeStreak(program, completedDates, new Date());

  // Taux de regularite depuis le debut du programme : jours dus vs jours reussis
  const today = toDayStart(new Date());
  let dueCount = 0;
  let doneCount = 0;
  const cursor = toDayStart(program.startDate);
  while (cursor.getTime() <= today.getTime()) {
    if (isDueOnDate(program, cursor)) {
      dueCount++;
      if (completedDates.has(cursor.toISOString().slice(0, 10))) doneCount++;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const regularityRate = dueCount > 0 ? Math.round((doneCount / dueCount) * 100) : 0;

  res.json({
    program,
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
