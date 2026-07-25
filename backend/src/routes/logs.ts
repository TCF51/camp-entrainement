import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { toDayStart } from "../utils/recurrence";
import { checkAndAwardBadges } from "../utils/badges";

const router = Router();
router.use(requireAuth);

const logSchema = z.object({
  campId: z.string(),
  exerciseId: z.string(),
  setsDone: z.number().min(1),
  valueDone: z.number().min(0),
  date: z.string().optional(), // optionnel, permet de rattraper un jour passe ; defaut = aujourd'hui
});

// Enregistre (ou met a jour) la realisation d'un exercice pour une journee donnee.
// L'idee n'est pas la performance, mais la regularite : un log = "je l'ai fait aujourd'hui".
router.post("/", async (req: AuthRequest, res) => {
  const parsed = logSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { campId, exerciseId, setsDone, valueDone, date } = parsed.data;

  const membership = await prisma.campMembership.findUnique({
    where: { userId_campId: { userId: req.userId!, campId } },
  });
  if (!membership) return res.status(403).json({ error: "Tu n'es pas membre de ce camp." });

  const day = toDayStart(date ? new Date(date) : new Date());

  const log = await prisma.exerciseLog.upsert({
    where: { userId_campId_exerciseId_date: { userId: req.userId!, campId, exerciseId, date: day } },
    create: { userId: req.userId!, campId, exerciseId, date: day, setsDone, valueDone, completed: true },
    update: { setsDone, valueDone, completed: true },
  });

  const newBadges = await checkAndAwardBadges(req.userId!);

  res.status(201).json({ log, newBadges });
});

// Permet d'annuler un log (ex: coche par erreur)
router.delete("/", async (req: AuthRequest, res) => {
  const campId = req.query.campId as string;
  const exerciseId = req.query.exerciseId as string;
  const dateStr = req.query.date as string | undefined;
  if (!campId || !exerciseId) {
    return res.status(400).json({ error: "campId et exerciseId sont requis." });
  }
  const day = toDayStart(dateStr ? new Date(dateStr) : new Date());

  await prisma.exerciseLog.deleteMany({
    where: { userId: req.userId, campId, exerciseId, date: day },
  });
  res.status(204).send();
});

export default router;
