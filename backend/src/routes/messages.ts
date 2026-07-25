import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

// Renvoie la liste des personnes avec qui on peut discuter : celles qui partagent
// au moins un camp avec l'utilisateur (on ne permet pas d'ecrire a un inconnu).
router.get("/contacts", async (req: AuthRequest, res) => {
  const myMemberships = await prisma.campMembership.findMany({
    where: { userId: req.userId },
    select: { campId: true },
  });
  const campIds = myMemberships.map((m) => m.campId);

  if (campIds.length === 0) return res.json([]);

  const otherMemberships = await prisma.campMembership.findMany({
    where: { campId: { in: campIds }, userId: { not: req.userId } },
    include: { user: { select: { id: true, name: true } } },
  });

  const contactsById = new Map(otherMemberships.map((m) => [m.user.id, m.user]));
  res.json([...contactsById.values()]);
});

async function assertContact(userId: string, otherUserId: string): Promise<boolean> {
  const shared = await prisma.campMembership.findFirst({
    where: {
      userId: otherUserId,
      camp: { members: { some: { userId } } },
    },
  });
  return !!shared;
}

// Recupere la conversation avec un utilisateur donne (dans les deux sens)
router.get("/:userId", async (req: AuthRequest, res) => {
  const otherUserId = req.params.userId;
  if (!(await assertContact(req.userId!, otherUserId))) {
    return res.status(403).json({ error: "Vous ne partagez aucun camp ensemble." });
  }

  const messages = await prisma.directMessage.findMany({
    where: {
      OR: [
        { senderId: req.userId, recipientId: otherUserId },
        { senderId: otherUserId, recipientId: req.userId },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 300,
  });

  res.json(messages);
});

const sendSchema = z.object({ recipientId: z.string(), body: z.string().min(1).max(2000) });

// Envoie un message prive, uniquement possible si les deux utilisateurs partagent un camp
router.post("/", async (req: AuthRequest, res) => {
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Message invalide." });
  }
  const { recipientId, body } = parsed.data;

  if (recipientId === req.userId) {
    return res.status(400).json({ error: "Impossible de s'envoyer un message a soi-meme." });
  }
  if (!(await assertContact(req.userId!, recipientId))) {
    return res.status(403).json({ error: "Vous ne partagez aucun camp ensemble." });
  }

  const message = await prisma.directMessage.create({
    data: { senderId: req.userId!, recipientId, body: body.trim() },
  });

  res.status(201).json(message);
});

export default router;
