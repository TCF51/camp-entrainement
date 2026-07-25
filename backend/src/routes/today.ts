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

  const dueToday = programs.filter((p) => isDueOnDate(p, today));

  const logsToday = await prisma.exerciseLog.findMany({
    where: { userId: req.userId, date: today },
  });
  const logByProgram = new Map(logsToday.map((l) => [`${l.campId}:${l.exerciseId}`, l]));

  const result = dueToday.map((p) => {
    const log = logByProgram.get(`${p.campId}:${p.exerciseId}`);
    return {
      programId: p.id,
      campId: p.campId,
      campName: p.camp.name,
      exerciseId: p.exerciseId,
      exerciseName: p.exercise.name,
      unit: p.exercise.unit,
      targetSets: p.targetSets,
      targetValue: p.targetValue,
      done: !!log,
      log: log ? { setsDone: log.setsDone, valueDone: log.valueDone } : null,
    };
  });

  res.json({ date: today.toISOString().slice(0, 10), items: result });
});

export default router;
