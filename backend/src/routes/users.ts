import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  weightKg: z.number().positive().nullable().optional(),
  heightCm: z.number().positive().nullable().optional(),
  birthDate: z.string().nullable().optional(), // format ISO "YYYY-MM-DD"
  sex: z.enum(["F", "M", "AUTRE"]).nullable().optional(),
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
  const { birthDate, ...rest } = parsed.data;

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: {
      ...rest,
      ...(birthDate !== undefined ? { birthDate: birthDate ? new Date(birthDate) : null } : {}),
    },
  });
  const { passwordHash, ...publicUser } = user;
  res.json(publicUser);
});

export default router;
