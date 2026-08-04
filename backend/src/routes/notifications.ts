import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

// Liste les notifications recentes de l'utilisateur (les plus recentes en premier)
router.get("/", async (req: AuthRequest, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json(notifications);
});

router.get("/unread-count", async (req: AuthRequest, res) => {
  const count = await prisma.notification.count({ where: { userId: req.userId, read: false } });
  res.json({ count });
});

// Marque une notification comme lue
router.post("/:id/read", async (req: AuthRequest, res) => {
  const notif = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!notif || notif.userId !== req.userId) return res.status(404).json({ error: "Notification introuvable." });
  await prisma.notification.update({ where: { id: req.params.id }, data: { read: true } });
  res.status(204).send();
});

// Marque toutes les notifications comme lues
router.post("/read-all", async (req: AuthRequest, res) => {
  await prisma.notification.updateMany({ where: { userId: req.userId, read: false }, data: { read: true } });
  res.status(204).send();
});

export default router;
