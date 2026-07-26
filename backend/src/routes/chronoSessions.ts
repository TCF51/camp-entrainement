import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { checkAndAwardBadges } from "../utils/badges";

const router = Router();
router.use(requireAuth);

const sessionSchema = z.object({
  name: z.string().max(200).optional().nullable(),
  items: z.array(z.string().min(1)).min(1),
  workSeconds: z.number().min(1),
  restSeconds: z.number().min(0),
  rounds: z.number().min(1),
  roundRestSeconds: z.number().min(0),
  totalDurationSeconds: z.number().min(1),
});

// Enregistre une seance de circuit training "libre" (construite depuis l'onglet Chrono,
// independante de tout camp) une fois qu'elle est terminee.
router.post("/", async (req: AuthRequest, res) => {
  const parsed = sessionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const data = parsed.data;

  const session = await prisma.chronoSession.create({
    data: {
      userId: req.userId!,
      name: data.name ?? null,
      items: JSON.stringify(data.items),
      workSeconds: data.workSeconds,
      restSeconds: data.restSeconds,
      rounds: data.rounds,
      roundRestSeconds: data.roundRestSeconds,
      totalDurationSeconds: data.totalDurationSeconds,
    },
  });

  const newBadges = await checkAndAwardBadges(req.userId!);
  res.status(201).json({ session, newBadges });
});

// Liste les seances chrono libres de l'utilisateur (les plus recentes en premier)
router.get("/", async (req: AuthRequest, res) => {
  const sessions = await prisma.chronoSession.findMany({
    where: { userId: req.userId },
    orderBy: { completedAt: "desc" },
    take: 100,
  });
  res.json(sessions);
});

export default router;
