import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

// Liste les circuits favoris de l'utilisateur
router.get("/", async (req: AuthRequest, res) => {
  const favorites = await prisma.favoriteCircuit.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "desc" },
  });
  res.json(favorites);
});

const createSchema = z.object({
  name: z.string().min(1).max(100),
  items: z.array(z.string().min(1)).min(1),
  workSeconds: z.number().min(1),
  restSeconds: z.number().min(0),
  rounds: z.number().min(1),
  roundRestSeconds: z.number().min(0),
});

// Sauvegarde un circuit construit dans l'onglet Chrono, pour le relancer plus tard
router.post("/", async (req: AuthRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const data = parsed.data;

  const favorite = await prisma.favoriteCircuit.create({
    data: {
      userId: req.userId!,
      name: data.name,
      items: JSON.stringify(data.items),
      workSeconds: data.workSeconds,
      restSeconds: data.restSeconds,
      rounds: data.rounds,
      roundRestSeconds: data.roundRestSeconds,
    },
  });
  res.status(201).json(favorite);
});

// Supprime un circuit favori
router.delete("/:id", async (req: AuthRequest, res) => {
  const favorite = await prisma.favoriteCircuit.findUnique({ where: { id: req.params.id } });
  if (!favorite || favorite.userId !== req.userId) {
    return res.status(404).json({ error: "Circuit favori introuvable." });
  }
  await prisma.favoriteCircuit.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
