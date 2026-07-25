import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { isDueOnDate, toDayStart } from "../utils/recurrence";

const router = Router();
router.use(requireAuth);

// Renvoie, pour aujourd'hui, tous les exercices dus (tous camps confondus)
// avec l'info si deja fait ou non.
router.get("/", async (req: AuthRequest, res) => {
  const today = toDayStart(new Date());

  const programs = await prisma.userProgram.findMany({
    where: { userId: req.userId, active: true },
    include: { exercise: true, camp: true },
  });

  // On ne propose que les programmes dont le camp est en cours (entre sa date de debut et de fin, si definies)
  const withinCampDates = programs.filter((p) => {
    if (p.camp.startDate && today.getTime() < toDayStart(p.camp.startDate).getTime()) return false;
    if (p.camp.endDate && today.getTime() > toDayStart(p.camp.endDate).getTime()) return false;
    return true;
  });

  const dueToday = withinCampDates.filter((p) => isDueOnDate(p, today));

  const logsToday = await prisma.exerciseLog.findMany({
    where: { userId: req.userId, date: today },
  });
  const logByProgram = new Map(logsToday.map((l) => [`${l.campId}:${l.exerciseId}`, l]));

  // Pour les exercices en mode "MAX", on va chercher le record personnel precedent a titre de reference
  const maxPrograms = dueToday.filter((p) => p.targetMode === "MAX");
  const bestByProgram = new Map<string, number>();
  for (const p of maxPrograms) {
    const best = await prisma.exerciseLog.findFirst({
      where: { userId: req.userId, campId: p.campId, exerciseId: p.exerciseId },
      orderBy: { valueDone: "desc" },
    });
    if (best) bestByProgram.set(`${p.campId}:${p.exerciseId}`, best.valueDone);
  }

  const result = dueToday.map((p) => {
    const key = `${p.campId}:${p.exerciseId}`;
    const log = logByProgram.get(key);
    return {
      programId: p.id,
      campId: p.campId,
      campName: p.camp.name,
      exerciseId: p.exerciseId,
      exerciseName: p.exercise.name,
      unit: p.exercise.unit,
      targetSets: p.targetSets,
      targetMode: p.targetMode,
      targetValue: p.targetValue,
      personalBest: bestByProgram.get(key) ?? null,
      done: !!log,
      log: log ? { setsDone: log.setsDone, valueDone: log.valueDone } : null,
    };
  });

  res.json({ date: today.toISOString().slice(0, 10), items: result });
});

export default router;
