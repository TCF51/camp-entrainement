import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

// Liste le catalogue complet : exercices par defaut + exercices "maison" ajoutes par les utilisateurs
router.get("/", async (_req, res) => {
  const exercises = await prisma.exercise.findMany({ orderBy: [{ isCustom: "asc" }, { name: "asc" }] });
  res.json(exercises);
});

const createSchema = z.object({
  name: z.string().min(1, "Le nom de l'exercice est requis."),
  description: z.string().optional(),
  unit: z.enum(["REPS", "SECONDS"]),
});

// Permet d'ajouter un exercice "maison" au catalogue partage
router.post("/", async (req: AuthRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const exercise = await prisma.exercise.create({
    data: { ...parsed.data, isCustom: true, createdById: req.userId },
  });
  res.status(201).json(exercise);
});

export default router;
