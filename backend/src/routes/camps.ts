import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { generateCampCode } from "../utils/code";

const router = Router();
router.use(requireAuth);

const createCampSchema = z.object({
  name: z.string().min(1, "Le nom du camp est requis."),
  exerciseIds: z.array(z.string()).min(1, "Selectionne au moins un exercice."),
});

// Cree un camp : choix d'un ensemble d'exercices, generation d'un code d'invitation.
// Le createur devient automatiquement membre du camp.
router.post("/", async (req: AuthRequest, res) => {
  const parsed = createCampSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { name, exerciseIds } = parsed.data;

  // On genere un code unique (tres faible probabilite de collision, on retente si besoin)
  let code = generateCampCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const clash = await prisma.camp.findUnique({ where: { code } });
    if (!clash) break;
    code = generateCampCode();
  }

  const camp = await prisma.camp.create({
    data: {
      name,
      code,
      createdById: req.userId!,
      exercises: { create: exerciseIds.map((exerciseId) => ({ exerciseId })) },
      members: { create: [{ userId: req.userId! }] },
    },
    include: { exercises: { include: { exercise: true } }, members: true },
  });

  res.status(201).json(camp);
});

const joinSchema = z.object({ code: z.string().min(1) });

// Rejoint un camp existant via son code d'invitation
router.post("/join", async (req: AuthRequest, res) => {
  const parsed = joinSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Code requis." });
  }
  const code = parsed.data.code.trim().toUpperCase();

  const camp = await prisma.camp.findUnique({ where: { code } });
  if (!camp) {
    return res.status(404).json({ error: "Aucun camp ne correspond a ce code." });
  }

  const existing = await prisma.campMembership.findUnique({
    where: { userId_campId: { userId: req.userId!, campId: camp.id } },
  });
  if (existing) {
    return res.status(200).json({ message: "Tu es deja membre de ce camp.", campId: camp.id });
  }

  await prisma.campMembership.create({ data: { userId: req.userId!, campId: camp.id } });
  res.status(201).json({ message: `Bienvenue dans le camp "${camp.name}" !`, campId: camp.id });
});

// Liste les camps dont l'utilisateur est membre
router.get("/mine", async (req: AuthRequest, res) => {
  const memberships = await prisma.campMembership.findMany({
    where: { userId: req.userId },
    include: {
      camp: {
        include: {
          exercises: { include: { exercise: true } },
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });
  res.json(memberships.map((m) => m.camp));
});

// Detail d'un camp (verifie que l'utilisateur en est bien membre)
router.get("/:id", async (req: AuthRequest, res) => {
  const membership = await prisma.campMembership.findUnique({
    where: { userId_campId: { userId: req.userId!, campId: req.params.id } },
  });
  if (!membership) {
    return res.status(403).json({ error: "Tu n'es pas membre de ce camp." });
  }

  const camp = await prisma.camp.findUnique({
    where: { id: req.params.id },
    include: {
      exercises: { include: { exercise: true } },
      members: { include: { user: { select: { id: true, name: true } } } },
    },
  });
  if (!camp) return res.status(404).json({ error: "Camp introuvable." });
  res.json(camp);
});

export default router;
