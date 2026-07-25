import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";

const router = Router();

// Cle publique VAPID, utilisee par le frontend pour s'abonner aux notifications
router.get("/vapid-public-key", (_req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || "" });
});

router.use(requireAuth);

const subscribeSchema = z.object({
  endpoint: z.string(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});

// Enregistre l'abonnement push du navigateur/appareil de l'utilisateur
router.post("/subscribe", async (req: AuthRequest, res) => {
  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Abonnement push invalide." });

  const { endpoint, keys } = parsed.data;
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: req.userId!, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    update: { userId: req.userId!, p256dh: keys.p256dh, auth: keys.auth },
  });
  res.status(201).json({ ok: true });
});

router.post("/unsubscribe", async (req: AuthRequest, res) => {
  const { endpoint } = req.body as { endpoint?: string };
  if (endpoint) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.userId } });
  }
  res.status(204).send();
});

export default router;
