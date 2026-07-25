import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

async function assertMember(userId: string, campId: string) {
  const membership = await prisma.campMembership.findUnique({
    where: { userId_campId: { userId, campId } },
  });
  return !!membership;
}

// Liste les messages du camp (les plus recents en dernier), reserve aux membres du camp
router.get("/:campId/messages", async (req: AuthRequest, res) => {
  const { campId } = req.params;
  if (!(await assertMember(req.userId!, campId))) {
    return res.status(403).json({ error: "Tu n'es pas membre de ce camp." });
  }

  const messages = await prisma.campMessage.findMany({
    where: { campId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
    take: 200, // garde-fou simple : les 200 derniers messages
  });

  res.json(messages);
});

const sendSchema = z.object({ body: z.string().min(1).max(2000) });

// Envoie un message dans le camp, reserve aux membres du camp
router.post("/:campId/messages", async (req: AuthRequest, res) => {
  const { campId } = req.params;
  if (!(await assertMember(req.userId!, campId))) {
    return res.status(403).json({ error: "Tu n'es pas membre de ce camp." });
  }

  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Le message ne peut pas etre vide." });
  }

  const message = await prisma.campMessage.create({
    data: { campId, userId: req.userId!, body: parsed.data.body.trim() },
    include: { user: { select: { id: true, name: true } } },
  });

  res.status(201).json(message);
});

export default router;
