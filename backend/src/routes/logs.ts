import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { toDayStart } from "../utils/recurrence";
import { checkAndAwardBadges } from "../utils/badges";

const router = Router();
router.use(requireAuth);

const logSchema = z.object({
  campId: z.string().optional(),
  campIds: z.array(z.string()).optional(), // pour valider un meme exercice sur plusieurs camps a la fois
  exerciseId: z.string(),
  setsDone: z.number().min(1),
  valueDone: z.number().min(0),
  date: z.string().optional(), // optionnel, permet de rattraper un jour passe ; defaut = aujourd'hui
});

// Enregistre (ou met à jour) la réalisation d'un exercice pour une journée donnée, pour un
// ou plusieurs camps a la fois (utile quand le meme exercice est present dans plusieurs camps
// et que l'utilisateur souhaite que ca compte pour tous en une seule validation).
// L'idee n'est pas la performance, mais la régularité : un log = "je l'ai fait aujourd'hui".
router.post("/", async (req: AuthRequest, res) => {
  const parsed = logSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { campId, campIds, exerciseId, setsDone, valueDone, date } = parsed.data;

  const targetCampIds = campIds && campIds.length > 0 ? campIds : campId ? [campId] : [];
  if (targetCampIds.length === 0) {
    return res.status(400).json({ error: "campId ou campIds requis." });
  }

  const memberships = await prisma.campMembership.findMany({
    where: { userId: req.userId, campId: { in: targetCampIds } },
  });
  if (memberships.length !== targetCampIds.length) {
    return res.status(403).json({ error: "Tu n'es pas membre de tous ces camps." });
  }

  const day = toDayStart(date ? new Date(date) : new Date());

  const logs = await Promise.all(
    targetCampIds.map((cId) =>
      prisma.exerciseLog.upsert({
        where: { userId_campId_exerciseId_date: { userId: req.userId!, campId: cId, exerciseId, date: day } },
        create: { userId: req.userId!, campId: cId, exerciseId, date: day, setsDone, valueDone, completed: true },
        update: { setsDone, valueDone, completed: true },
      })
    )
  );

  const newBadges = await checkAndAwardBadges(req.userId!);

  res.status(201).json({ log: logs[0], logs, newBadges });
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
