import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { isDueOnDate, toDayStart } from "../utils/recurrence";

const router = Router();
router.use(requireAuth);

// Renvoie, pour aujourd'hui, tous les exercices et circuits dus (tous camps dont l'utilisateur
// est membre) selon la consigne definie par le createur de chaque camp, avec l'info si deja fait.
router.get("/", async (req: AuthRequest, res) => {
  const today = toDayStart(new Date());

  const memberships = await prisma.campMembership.findMany({
    where: { userId: req.userId },
    include: {
      camp: {
        include: { exercises: { include: { exercise: true } }, circuits: true },
      },
    },
  });

  const campExercises = memberships.flatMap((m) =>
    m.camp.exercises.map((ce) => ({ ...ce, camp: m.camp }))
  );
  const campCircuits = memberships.flatMap((m) => m.camp.circuits.map((cc) => ({ ...cc, camp: m.camp })));

  // On ne propose que ce dont le camp est en cours (entre sa date de debut et de fin, si definies)
  function withinCampDates(camp: { startDate: Date | null; endDate: Date | null }) {
    if (camp.startDate && today.getTime() < toDayStart(camp.startDate).getTime()) return false;
    if (camp.endDate && today.getTime() > toDayStart(camp.endDate).getTime()) return false;
    return true;
  }

  const dueExercises = campExercises.filter((ce) => withinCampDates(ce.camp) && isDueOnDate(ce, today));
  const dueCircuits = campCircuits.filter((cc) => withinCampDates(cc.camp) && isDueOnDate(cc, today));

  const [logsToday, circuitLogsToday] = await Promise.all([
    prisma.exerciseLog.findMany({ where: { userId: req.userId, date: today } }),
    prisma.campCircuitLog.findMany({ where: { userId: req.userId, date: today } }),
  ]);
  const logByExercise = new Map(logsToday.map((l) => [`${l.campId}:${l.exerciseId}`, l]));
  const logByCircuit = new Map(circuitLogsToday.map((l) => [l.campCircuitId, l]));

  // Pour les exercices en mode "MAX", on va chercher le record personnel precedent a titre de reference
  const maxExercises = dueExercises.filter((ce) => ce.targetMode === "MAX");
  const bestByExercise = new Map<string, number>();
  for (const ce of maxExercises) {
    const best = await prisma.exerciseLog.findFirst({
      where: { userId: req.userId, campId: ce.campId, exerciseId: ce.exerciseId },
      orderBy: { valueDone: "desc" },
    });
    if (best) bestByExercise.set(`${ce.campId}:${ce.exerciseId}`, best.valueDone);
  }

  const exerciseItems = dueExercises.map((ce) => {
    const key = `${ce.campId}:${ce.exerciseId}`;
    const log = logByExercise.get(key);
    return {
      kind: "exercise" as const,
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

  const circuitItems = dueCircuits.map((cc) => {
    const log = logByCircuit.get(cc.id);
    return {
      kind: "circuit" as const,
      campCircuitId: cc.id,
      campId: cc.campId,
      campName: cc.camp.name,
      name: cc.name,
      description: cc.description,
      items: JSON.parse(cc.items) as { exerciseId?: string; name: string }[],
      workSeconds: cc.workSeconds,
      restSeconds: cc.restSeconds,
      rounds: cc.rounds,
      roundRestSeconds: cc.roundRestSeconds,
      done: !!log,
    };
  });

  res.json({ date: today.toISOString().slice(0, 10), items: exerciseItems, circuits: circuitItems });
});

export default router;
