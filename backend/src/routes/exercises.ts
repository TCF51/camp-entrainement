import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { EQUIPMENT_KEYS } from "../utils/equipment";

const router = Router();
router.use(requireAuth);

const CATEGORY_KEYS = ["UPPER", "LOWER", "ABS", "CARDIO", "FULL_BODY", "MOBILITY"] as const;

// Liste le catalogue complet : exercices par defaut + exercices "maison" ajoutes par les utilisateurs.
// Filtres optionnels par categorie et/ou materiel disponible (voir query params).
router.get("/", async (req, res) => {
  const category = req.query.category as string | undefined;
  const exercises = await prisma.exercise.findMany({ orderBy: [{ isCustom: "asc" }, { name: "asc" }] });
  const filtered = category ? exercises.filter((e) => e.category === category) : exercises;
  res.json(filtered);
});

router.get("/categories", (_req, res) => {
  res.json(CATEGORY_KEYS);
});

// Répertoire complet du catalogue avec, pour chaque exercice, son nombre d'utilisations
// (nombre de camps distincts qui l'utilisent, tous camps confondus -- même ceux dont
// l'utilisateur ne fait pas partie). Purement statistique, aucun detail sur les camps n'est expose.
router.get("/stats", async (_req, res) => {
  const exercises = await prisma.exercise.findMany({
    orderBy: [{ isCustom: "asc" }, { name: "asc" }],
    include: { _count: { select: { campExercises: true } } },
  });
  res.json(
    exercises.map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description,
      unit: e.unit,
      category: e.category,
      equipment: e.equipment,
      isCustom: e.isCustom,
      campCount: e._count.campExercises,
    }))
  );
});

const createSchema = z.object({
  name: z.string().min(1, "Le nom de l'exercice est requis."),
  description: z.string().optional(),
  unit: z.enum(["REPS", "SECONDS"]),
  category: z.enum(CATEGORY_KEYS).optional().nullable(),
  equipment: z.array(z.enum(EQUIPMENT_KEYS as [string, ...string[]])).optional(),
  imageBase64: z.string().max(2_000_000).optional().nullable(),
  videoUrl: z.string().url().max(500).optional().nullable(),
});

// Permet d'ajouter un exercice "maison" au catalogue partage, avec categorie, materiel
// necessaire, et une image/video descriptive optionnelle.
router.post("/", async (req: AuthRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { equipment, ...rest } = parsed.data;
  const exercise = await prisma.exercise.create({
    data: {
      ...rest,
      equipment: equipment ? JSON.stringify(equipment) : null,
      isCustom: true,
      createdById: req.userId,
    },
  });
  res.status(201).json(exercise);
});

const updateSchema = createSchema.partial();

// Modifie un exercice existant (ex: ajouter une image apres coup) : reserve a son createur
router.put("/:id", async (req: AuthRequest, res) => {
  const existing = await prisma.exercise.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Exercice introuvable." });
  if (existing.createdById && existing.createdById !== req.userId) {
    return res.status(403).json({ error: "Seul le createur de cet exercice peut le modifier." });
  }

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { equipment, ...rest } = parsed.data;

  const exercise = await prisma.exercise.update({
    where: { id: req.params.id },
    data: {
      ...rest,
      ...(equipment !== undefined ? { equipment: equipment ? JSON.stringify(equipment) : null } : {}),
    },
  });
  res.json(exercise);
});

export default router;
