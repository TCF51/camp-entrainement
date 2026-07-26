import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { toDayStart } from "../utils/recurrence";

const router = Router();
router.use(requireAuth);

// Liste les jours de repos de l'utilisateur (utile pour l'affichage calendrier)
router.get("/", async (req: AuthRequest, res) => {
  const restDays = await prisma.restDay.findMany({
    where: { userId: req.userId },
    orderBy: { date: "desc" },
  });
  res.json(restDays);
});

const createSchema = z.object({
  date: z.string().optional(), // par defaut aujourd'hui
  reason: z.string().max(200).optional().nullable(),
});

// Marque un jour comme "repos justifie" : ce jour ne cassera pas les series de regularite
router.post("/", async (req: AuthRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Requete invalide." });
  }
  const day = toDayStart(parsed.data.date ? new Date(parsed.data.date) : new Date());

  const restDay = await prisma.restDay.upsert({
    where: { userId_date: { userId: req.userId!, date: day } },
    create: { userId: req.userId!, date: day, reason: parsed.data.reason ?? null },
    update: { reason: parsed.data.reason ?? null },
  });

  res.status(201).json(restDay);
});

// Retire le statut "repos" d'un jour (ex: marque par erreur)
router.delete("/", async (req: AuthRequest, res) => {
  const dateStr = req.query.date as string | undefined;
  const day = toDayStart(dateStr ? new Date(dateStr) : new Date());

  await prisma.restDay.deleteMany({ where: { userId: req.userId, date: day } });
  res.status(204).send();
});

export default router;
