import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { sendEmail } from "../services/email";

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

const forgotSchema = z.object({ email: z.string().email() });

// Demande de reinitialisation : genere un jeton valable 1h et envoie un email (si configure).
// Repond toujours de la meme facon, que l'email existe ou non, pour ne pas reveler qui a un compte.
router.post("/forgot-password", async (req, res) => {
  const parsed = forgotSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Adresse email invalide." });
  }
  const { email } = parsed.data;

  const genericResponse = {
    message: "Si un compte existe avec cet email, un lien de reinitialisation vient d'etre envoye.",
  };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.json(genericResponse);

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 heure

  await prisma.passwordResetToken.create({ data: { userId: user.id, token, expiresAt } });

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const resetLink = `${frontendUrl}/reinitialiser-mot-de-passe?token=${token}`;

  await sendEmail(
    email,
    "Reinitialisation de ton mot de passe GoTeam",
    `Bonjour ${user.name},\n\nClique sur ce lien pour choisir un nouveau mot de passe (valable 1 heure) :\n${resetLink}\n\nSi tu n'es pas a l'origine de cette demande, ignore simplement cet email.`
  );

  return res.json(genericResponse);
});

const resetSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8, "Le mot de passe doit faire au moins 8 caracteres."),
});

// Applique le nouveau mot de passe si le jeton est valide, non expire et non deja utilise
router.post("/reset-password", async (req, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { token, newPassword } = parsed.data;

  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!resetToken || resetToken.used || resetToken.expiresAt.getTime() < Date.now()) {
    return res.status(400).json({ error: "Ce lien de reinitialisation est invalide ou a expire." });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { used: true } }),
  ]);

  res.json({ message: "Mot de passe mis a jour, tu peux te connecter." });
});

export default router;
