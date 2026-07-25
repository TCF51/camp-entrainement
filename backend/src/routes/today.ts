import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { isDueOnDate, toDayStart } from "../utils/recurrence";

const router = Router();
router.use(requireAuth);

// Renvoie, pour aujourd'hui, tous les exercices dus (tous camps dont l'utilisateur est membre)
// selon la consigne definie par le createur de chaque camp, avec l'info si deja fait ou non.
router.get("/", async (req: AuthRequest, res) => {
  const today = toDayStart(new Date());

  const memberships = await prisma.campMembership.findMany({
    where: { userId: req.userId },
    include: {
      camp: {
        include: { exercises: { include: { exercise: true } } },
      },
    },
  });

  const campExercises = memberships.flatMap((m) =>
    m.camp.exercises.map((ce) => ({ ...ce, camp: m.camp }))
  );

  // On ne propose que les exercices dont le camp est en cours (entre sa date de debut et de fin, si definies)
  const withinCampDates = campExercises.filter((ce) => {
    if (ce.camp.startDate && today.getTime() < toDayStart(ce.camp.startDate).getTime()) return false;
    if (ce.camp.endDate && today.getTime() > toDayStart(ce.camp.endDate).getTime()) return false;
    return true;
  });

  const dueToday = withinCampDates.filter((ce) => isDueOnDate(ce, today));

  const logsToday = await prisma.exerciseLog.findMany({
    where: { userId: req.userId, date: today },
  });
  const logByExercise = new Map(logsToday.map((l) => [`${l.campId}:${l.exerciseId}`, l]));

  // Pour les exercices en mode "MAX", on va chercher le record personnel precedent a titre de reference
  const maxExercises = dueToday.filter((ce) => ce.targetMode === "MAX");
  const bestByExercise = new Map<string, number>();
  for (const ce of maxExercises) {
    const best = await prisma.exerciseLog.findFirst({
      where: { userId: req.userId, campId: ce.campId, exerciseId: ce.exerciseId },
      orderBy: { valueDone: "desc" },
    });
    if (best) bestByExercise.set(`${ce.campId}:${ce.exerciseId}`, best.valueDone);
  }

  const result = dueToday.map((ce) => {
    const key = `${ce.campId}:${ce.exerciseId}`;
    const log = logByExercise.get(key);
    return {
      campExerciseId: ce.id,
      campId: ce.campId,
      campName: ce.camp.name,
      exerciseId: ce.exerciseId,
      exerciseName: ce.exercise.name,
      description: ce.description,
      unit: ce.exercise.unit,
      targetSets: ce.targetSets,
      targetMode: ce.targetMode,
      targetValue: ce.targetValue,
      personalBest: bestByExercise.get(key) ?? null,
      done: !!log,
      log: log ? { setsDone: log.setsDone, valueDone: log.valueDone } : null,
    };
  });

  res.json({ date: today.toISOString().slice(0, 10), items: result });
});

export default router;
