import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { REACTION_CATALOG, REACTION_KEYS } from "../utils/reactions";
import { notifyUser } from "../services/notifications";

const router = Router();
router.use(requireAuth);

router.get("/catalog", (_req, res) => {
  res.json(REACTION_CATALOG);
});

const toggleSchema = z.object({
  targetType: z.enum(["exercise", "circuit"]),
  targetId: z.string(),
  type: z.enum(REACTION_KEYS as [string, ...string[]]),
});

// Ajoute ou retire une reaction (bascule) sur une séance validee par un membre du même camp.
router.post("/", async (req: AuthRequest, res) => {
  const parsed = toggleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Reaction invalide." });
  }
  const { targetType, targetId, type } = parsed.data;

  // Vérifie que la cible existe et recupere son camp, pour s'assurer que l'utilisateur
  // en est bien membre (on ne peut reagir qu'aux séances de ses propres camps).
  let campId: string | null = null;
  let ownerId: string | null = null;
  if (targetType === "exercise") {
    const log = await prisma.exerciseLog.findUnique({ where: { id: targetId } });
    campId = log?.campId ?? null;
    ownerId = log?.userId ?? null;
  } else {
    const log = await prisma.campCircuitLog.findUnique({ where: { id: targetId } });
    campId = log?.campId ?? null;
    ownerId = log?.userId ?? null;
  }
  if (!campId) return res.status(404).json({ error: "Séance introuvable." });

  const membership = await prisma.campMembership.findUnique({
    where: { userId_campId: { userId: req.userId!, campId } },
  });
  if (!membership) return res.status(403).json({ error: "Tu n'es pas membre de ce camp." });

  const existing = await prisma.reaction.findUnique({
    where: { userId_targetType_targetId_type: { userId: req.userId!, targetType, targetId, type } },
  });

  if (existing) {
    await prisma.reaction.delete({ where: { id: existing.id } });
    return res.json({ active: false });
  }

  await prisma.reaction.create({ data: { userId: req.userId!, targetType, targetId, type } });

  if (ownerId && ownerId !== req.userId) {
    const def = REACTION_CATALOG.find((r) => r.key === type);
    const me = await prisma.user.findUnique({ where: { id: req.userId } });
    notifyUser(
      ownerId,
      "REACTION",
      `${def?.emoji ?? "👏"} Nouvelle reaction`,
      `${me?.name ?? "Quelqu'un"} a reagi a ta séance (${def?.label ?? type}).`,
      `/camps/${campId}`
    ).catch(() => {});
  }

  res.status(201).json({ active: true });
});

export default router;
