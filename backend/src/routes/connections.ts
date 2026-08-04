import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { computeOverallRegularityRate } from "../utils/badges";
import { notifyUser } from "../services/notifications";

const router = Router();
router.use(requireAuth);

// Liste mes relations : coequipiers acceptes + demandes en attente (envoyees et recues)
router.get("/", async (req: AuthRequest, res) => {
  const [sent, received] = await Promise.all([
    prisma.connection.findMany({
      where: { requesterId: req.userId },
      include: { recipient: { select: { id: true, name: true, avatarBase64: true, location: true } } },
    }),
    prisma.connection.findMany({
      where: { recipientId: req.userId },
      include: { requester: { select: { id: true, name: true, avatarBase64: true, location: true } } },
    }),
  ]);

  const accepted = [
    ...sent.filter((c) => c.status === "ACCEPTED").map((c) => ({ connectionId: c.id, user: c.recipient })),
    ...received.filter((c) => c.status === "ACCEPTED").map((c) => ({ connectionId: c.id, user: c.requester })),
  ];
  const pendingSent = sent
    .filter((c) => c.status === "PENDING")
    .map((c) => ({ connectionId: c.id, user: c.recipient }));
  const pendingReceived = received
    .filter((c) => c.status === "PENDING")
    .map((c) => ({ connectionId: c.id, user: c.requester }));

  res.json({ accepted, pendingSent, pendingReceived });
});

const requestSchema = z.object({ recipientId: z.string() });

// Envoie une demande pour devenir "coequipier" d'un autre utilisateur
router.post("/", async (req: AuthRequest, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Requete invalide." });
  const { recipientId } = parsed.data;

  if (recipientId === req.userId) {
    return res.status(400).json({ error: "Impossible de s'ajouter soi-meme." });
  }

  const existing = await prisma.connection.findFirst({
    where: {
      OR: [
        { requesterId: req.userId!, recipientId },
        { requesterId: recipientId, recipientId: req.userId! },
      ],
    },
  });
  if (existing) {
    return res.status(409).json({ error: "Une demande existe deja avec cette personne." });
  }

  const connection = await prisma.connection.create({
    data: { requesterId: req.userId!, recipientId, status: "PENDING" },
  });

  const me = await prisma.user.findUnique({ where: { id: req.userId } });
  notifyUser(
    recipientId,
    "TEAMMATE_REQUEST",
    "🤝 Nouvelle demande",
    `${me?.name ?? "Quelqu'un"} veut devenir ton coequipier.`,
    "/coequipiers",
    connection.id
  ).catch(() => {});

  res.status(201).json(connection);
});

// Accepte une demande recue
router.post("/:id/accept", async (req: AuthRequest, res) => {
  const connection = await prisma.connection.findUnique({ where: { id: req.params.id } });
  if (!connection || connection.recipientId !== req.userId) {
    return res.status(404).json({ error: "Demande introuvable." });
  }
  const updated = await prisma.connection.update({ where: { id: req.params.id }, data: { status: "ACCEPTED" } });
  res.json(updated);
});

// Refuse une demande recue, ou annule/supprime une relation existante
router.delete("/:id", async (req: AuthRequest, res) => {
  const connection = await prisma.connection.findUnique({ where: { id: req.params.id } });
  if (!connection || (connection.recipientId !== req.userId && connection.requesterId !== req.userId)) {
    return res.status(404).json({ error: "Relation introuvable." });
  }
  await prisma.connection.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

async function areTeammatesOrCampmates(userId: string, otherUserId: string): Promise<boolean> {
  const connection = await prisma.connection.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { requesterId: userId, recipientId: otherUserId },
        { requesterId: otherUserId, recipientId: userId },
      ],
    },
  });
  if (connection) return true;

  const sharedCamp = await prisma.campMembership.findFirst({
    where: { userId: otherUserId, camp: { members: { some: { userId } } } },
  });
  return !!sharedCamp;
}

// Profil public d'un coequipier (ou d'un membre d'un camp commun) : infos de base +
// taux de regularite global + liste de ses camps.
router.get("/:userId/profile", async (req: AuthRequest, res) => {
  const otherUserId = req.params.userId;
  if (!(await areTeammatesOrCampmates(req.userId!, otherUserId))) {
    return res.status(403).json({ error: "Vous devez etre coequipiers ou partager un camp pour voir ce profil." });
  }

  const user = await prisma.user.findUnique({
    where: { id: otherUserId },
    select: {
      id: true,
      name: true,
      avatarBase64: true,
      location: true,
      sport: true,
      sportLevel: true,
      createdAt: true,
    },
  });
  if (!user) return res.status(404).json({ error: "Utilisateur introuvable." });

  const [overallRegularityRate, memberships, badgeCount] = await Promise.all([
    computeOverallRegularityRate(otherUserId),
    prisma.campMembership.findMany({
      where: { userId: otherUserId },
      include: { camp: { include: { _count: { select: { members: true } } } } },
    }),
    prisma.userBadge.count({ where: { userId: otherUserId } }),
  ]);

  res.json({
    ...user,
    overallRegularityRate,
    badgeCount,
    camps: memberships.map((m) => ({
      id: m.camp.id,
      name: m.camp.name,
      description: m.camp.description,
      memberCount: m.camp._count.members,
    })),
  });
});

export default router;
