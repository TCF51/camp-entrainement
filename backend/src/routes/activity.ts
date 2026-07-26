import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

// Historique complet de l'activite de l'utilisateur (exercices individuels, circuits de camp,
// seances chrono libres), avec quelques statistiques agregees. Sert de "carnet d'entrainement".
router.get("/", async (req: AuthRequest, res) => {
  const userId = req.userId!;

  const [exerciseLogs, circuitLogs, chronoSessions] = await Promise.all([
    prisma.exerciseLog.findMany({
      where: { userId },
      include: { exercise: true, camp: { select: { name: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.campCircuitLog.findMany({
      where: { userId },
      include: { campCircuit: { select: { name: true } }, camp: { select: { name: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.chronoSession.findMany({
      where: { userId },
      orderBy: { completedAt: "desc" },
    }),
  ]);

  const items = [
    ...exerciseLogs.map((l) => ({
      type: "exercise" as const,
      date: l.date.toISOString(),
      exerciseName: l.exercise.name,
      unit: l.exercise.unit,
      campName: l.camp.name,
      setsDone: l.setsDone,
      valueDone: l.valueDone,
    })),
    ...circuitLogs.map((l) => ({
      type: "circuit" as const,
      date: l.date.toISOString(),
      circuitName: l.campCircuit.name,
      campName: l.camp.name,
      durationSeconds: l.durationSeconds,
    })),
    ...chronoSessions.map((s) => ({
      type: "chrono" as const,
      date: s.completedAt.toISOString(),
      name: s.name,
      items: JSON.parse(s.items) as string[],
      totalDurationSeconds: s.totalDurationSeconds,
      rounds: s.rounds,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Statistiques agregees
  const totalSessions = exerciseLogs.length + circuitLogs.length + chronoSessions.length;

  // Temps de pratique : uniquement ce qui est mesurable (exercices en secondes + circuits + chrono libre).
  // Les exercices en repetitions n'ont pas de duree intrinseque, ils comptent dans le nombre de seances
  // mais pas dans le temps total.
  const exerciseSeconds = exerciseLogs
    .filter((l) => l.exercise.unit === "SECONDS")
    .reduce((sum, l) => sum + l.setsDone * l.valueDone, 0);
  const circuitSeconds = circuitLogs.reduce((sum, l) => sum + l.durationSeconds, 0);
  const chronoSeconds = chronoSessions.reduce((sum, s) => sum + s.totalDurationSeconds, 0);
  const totalPracticeSeconds = exerciseSeconds + circuitSeconds + chronoSeconds;

  const exerciseNames = new Set(exerciseLogs.map((l) => l.exercise.name));

  // Record personnel par exercice : la meilleure valeur realisee sur UNE serie (pas le cumul)
  const bestByExercise = new Map<string, { exerciseName: string; unit: string; best: number }>();
  for (const l of exerciseLogs) {
    const current = bestByExercise.get(l.exerciseId);
    if (!current || l.valueDone > current.best) {
      bestByExercise.set(l.exerciseId, { exerciseName: l.exercise.name, unit: l.exercise.unit, best: l.valueDone });
    }
  }

  res.json({
    stats: {
      totalSessions,
      totalPracticeSeconds,
      exerciseCount: exerciseNames.size,
      personalBests: [...bestByExercise.values()],
    },
    items,
  });
});

export default router;
