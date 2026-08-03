import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { EQUIPMENT_KEYS } from "../utils/equipment";
import { computeOverallRegularityRate } from "../utils/badges";

const router = Router();
router.use(requireAuth);

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  weightKg: z.number().positive().nullable().optional(),
  heightCm: z.number().positive().nullable().optional(),
  birthDate: z.string().nullable().optional(), // format ISO "YYYY-MM-DD"
  sex: z.enum(["F", "M", "AUTRE"]).nullable().optional(),
  sport: z.string().max(100).nullable().optional(),
  sportLevel: z.enum(["LOISIR", "COMPETITION"]).nullable().optional(),
  location: z.string().max(150).nullable().optional(),
  equipment: z.array(z.enum(EQUIPMENT_KEYS as [string, ...string[]])).nullable().optional(),
  // data URL (ex: "data:image/jpeg;base64,...") ; limite large mais raisonnable une fois
  // l'image redimensionnee/compressee cote client avant l'envoi.
  avatarBase64: z.string().max(2_000_000).nullable().optional(),
});

router.get("/me", async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "Utilisateur introuvable." });
  const { passwordHash, ...publicUser } = user;
  res.json(publicUser);
});

router.put("/me", async (req: AuthRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { birthDate, equipment, ...rest } = parsed.data;

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: {
      ...rest,
      ...(birthDate !== undefined ? { birthDate: birthDate ? new Date(birthDate) : null } : {}),
      ...(equipment !== undefined ? { equipment: equipment ? JSON.stringify(equipment) : null } : {}),
    },
  });
  const { passwordHash, ...publicUser } = user;
  res.json(publicUser);
});

// Resume des camps de l'utilisateur (nom, descriptif, nombre d'inscrits, son propre role/
// participation) + son taux de regularite global, pour la section "Mes camps" du profil.
router.get("/me/summary", async (req: AuthRequest, res) => {
  const [memberships, overallRegularityRate] = await Promise.all([
    prisma.campMembership.findMany({
      where: { userId: req.userId },
      include: {
        camp: {
          include: {
            exercises: { include: { exercise: true } },
            _count: { select: { members: true } },
          },
        },
      },
    }),
    computeOverallRegularityRate(req.userId!),
  ]);

  res.json({
    overallRegularityRate,
    camps: memberships.map((m) => ({
      id: m.camp.id,
      name: m.camp.name,
      description: m.camp.description,
      role: m.role,
      memberCount: m.camp._count.members,
      exercises: m.camp.exercises.map((ce) => ce.exercise.name),
    })),
  });
});

// Recherche d'utilisateurs par nom (pour devenir "coequipier"). Ne renvoie que des infos
// minimales, jamais l'email ni des donnees sensibles.
router.get("/search", async (req: AuthRequest, res) => {
  const q = (req.query.q as string | undefined)?.trim();
  if (!q || q.length < 2) return res.json([]);

  const users = await prisma.user.findMany({
    where: { name: { contains: q }, id: { not: req.userId } },
    select: { id: true, name: true, avatarBase64: true, location: true },
    take: 20,
  });
  res.json(users);
});

export default router;
