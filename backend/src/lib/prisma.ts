import { PrismaClient } from "@prisma/client";

// Instance unique du client Prisma, reutilisee partout dans l'app
export const prisma = new PrismaClient();
