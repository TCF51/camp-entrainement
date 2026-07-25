import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const router = Router();

const registerSchema = z.object({
  email: z.string().email("Adresse email invalide."),
  password: z.string().min(8, "Le mot de passe doit faire au moins 8 caracteres."),
  name: z.string().min(1, "Le nom est requis."),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function signToken(userId: string): string {
  const secret = process.env.JWT_SECRET as string;
  const expiresIn = process.env.JWT_EXPIRES_IN || "30d";
  return jwt.sign({ userId }, secret, { expiresIn } as jwt.SignOptions);
}

function toPublicUser(user: {
  id: string;
  email: string;
  name: string;
  weightKg: number | null;
  heightCm: number | null;
  birthDate: Date | null;
  sex: string | null;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    weightKg: user.weightKg,
    heightCm: user.heightCm,
    birthDate: user.birthDate,
    sex: user.sex,
  };
}

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { email, password, name } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "Un compte existe deja avec cet email." });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { email, passwordHash, name } });

  const token = signToken(user.id);
  return res.status(201).json({ token, user: toPublicUser(user) });
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Email et mot de passe requis." });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: "Email ou mot de passe incorrect." });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Email ou mot de passe incorrect." });
  }

  const token = signToken(user.id);
  return res.json({ token, user: toPublicUser(user) });
});

export default router;
