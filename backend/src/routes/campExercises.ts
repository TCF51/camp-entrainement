import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { notifyUser } from "../services/notifications";

const router = Router();
router.use(requireAuth);

const recurrenceSchema = z.discriminatedUnion("recurrenceType", [
  z.object({ recurrenceType: z.literal("DAILY") }),
  z.object({ recurrenceType: z.literal("WEEKLY"), daysOfWeek: z.array(z.number().min(0).max(6)).min(1) }),
  z.object({ recurrenceType: z.literal("EVERY_N_DAYS"), intervalDays: z.number().min(1) }),
  z.object({ recurrenceType: z.literal("WEEKLY_COUNT"), timesPerWeek: z.number().min(1).max(7) }),
]);

const targetSchema = z.discriminatedUnion("targetMode", [
  z.object({ targetMode: z.literal("FIXED"), targetValue: z.number().min(1) }),
  z.object({ targetMode: z.literal("MAX"), targetValue: z.number().min(1).optional() }),
]);

const updateSchema = z
  .object({
    campId: z.string(),
    exerciseId: z.string(),
    description: z.string().max(500).optional().nullable(),
    targetSets: z.number().min(1),
  })
  .and(targetSchema)
  .and(recurrenceSchema);

// Met à jour la consigne d'un exercice au sein d'un camp : réservé au créateur du camp
// (la "casquette entraîneur"). Les autres membres ne peuvent que consulter.
router.put("/", async (req: AuthRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const data = parsed.data;

  const camp = await prisma.camp.findUnique({ where: { id: data.campId } });
  if (!camp) return res.status(404).json({ error: "Camp introuvable." });
  if (camp.createdById !== req.userId) {
    return res.status(403).json({ error: "Seul le créateur du camp peut définir les consignes des exercices." });
  }

  const campExercise = await prisma.campExercise.findUnique({
    where: { campId_exerciseId: { campId: data.campId, exerciseId: data.exerciseId } },
  });
  if (!campExercise) return res.status(400).json({ error: "Cet exercice ne fait pas partie du camp." });

  const updated = await prisma.campExercise.update({
    where: { campId_exerciseId: { campId: data.campId, exerciseId: data.exerciseId } },
    data: {
      description: data.description ?? null,
      targetSets: data.targetSets,
      targetMode: data.targetMode,
      targetValue: data.targetMode === "FIXED" ? data.targetValue : data.targetValue ?? null,
      recurrenceType: data.recurrenceType,
      daysOfWeek: data.recurrenceType === "WEEKLY" ? JSON.stringify(data.daysOfWeek) : null,
      intervalDays: data.recurrenceType === "EVERY_N_DAYS" ? data.intervalDays : null,
      timesPerWeek: data.recurrenceType === "WEEKLY_COUNT" ? data.timesPerWeek : null,
    },
    include: { exercise: true },
  });

  prisma.campMembership.findMany({ where: { campId: data.campId, userId: { not: req.userId } } }).then((others) => {
    for (const m of others) {
      notifyUser(
        m.userId,
        "CAMP_UPDATED",
        `📋 ${camp.name}`,
        `La consigne de "${updated.exercise.name}" a ete modifiee.`,
        `/camps/${data.campId}`
      ).catch(() => {});
    }
  });

  res.json(updated);
});

export default router;
