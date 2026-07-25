import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { BADGE_CATALOG } from "../utils/badges";

const router = Router();
router.use(requireAuth);

// Renvoie les badges obtenus par l'utilisateur, ainsi que le catalogue complet
// (pour pouvoir afficher les badges pas encore obtenus en "verrouille" si souhaite).
router.get("/", async (req: AuthRequest, res) => {
  const earned = await prisma.userBadge.findMany({
    where: { userId: req.userId },
    orderBy: { earnedAt: "asc" },
  });

  const earnedMap = new Map(earned.map((b) => [b.badgeKey, b.earnedAt]));

  const badges = BADGE_CATALOG.map((def) => ({
    ...def,
    earned: earnedMap.has(def.key),
    earnedAt: earnedMap.get(def.key) ?? null,
  }));

  res.json(badges);
});

export default router;
