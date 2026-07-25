// Peuple la base avec un catalogue d'exercices "de base" a choix large.
// Lancer avec : npm run seed
import { PrismaClient, ExerciseUnit } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_EXERCISES: { name: string; description: string; unit: ExerciseUnit }[] = [
  { name: "Pompes", description: "Pompes classiques, poitrine proche du sol.", unit: "REPS" },
  { name: "Chaise contre le mur", description: "Dos au mur, cuisses a l'horizontale, on tient.", unit: "SECONDS" },
  { name: "Gainage planche", description: "Gainage ventral sur les avant-bras, corps aligne.", unit: "SECONDS" },
  { name: "Gainage laterale (par cote)", description: "Gainage sur un avant-bras, corps de profil.", unit: "SECONDS" },
  { name: "Squats", description: "Flexion des jambes, dos droit, cuisses parallèles au sol.", unit: "REPS" },
  { name: "Fentes avant (par jambe)", description: "Fentes alternees, genou arriere proche du sol.", unit: "REPS" },
  { name: "Tractions", description: "Tractions en pronation ou supination a la barre.", unit: "REPS" },
  { name: "Dips", description: "Extension des bras sur barres paralleles ou banc.", unit: "REPS" },
  { name: "Abdominaux (crunchs)", description: "Releves de buste, mains aux tempes ou croisees.", unit: "REPS" },
  { name: "Mountain climbers", description: "Genoux ramenes alternativement en position de planche.", unit: "REPS" },
  { name: "Burpees", description: "Squat, planche, pompe, saut : enchainement complet.", unit: "REPS" },
  { name: "Corde a sauter", description: "Sauts a la corde, rythme regulier.", unit: "SECONDS" },
  { name: "Superman (extension dorsale)", description: "Allonge sur le ventre, on souleve bras et jambes.", unit: "SECONDS" },
  { name: "Course a pied", description: "Footing ou fractionne, en minutes converties en secondes.", unit: "SECONDS" },
  { name: "Montee de genoux sur place", description: "Genoux montes alternativement le plus haut possible.", unit: "REPS" },
];

async function main() {
  for (const exo of DEFAULT_EXERCISES) {
    const existing = await prisma.exercise.findFirst({ where: { name: exo.name, isCustom: false } });
    if (!existing) {
      await prisma.exercise.create({ data: { ...exo, isCustom: false } });
      console.log(`Exercice cree : ${exo.name}`);
    }
  }
  console.log("Catalogue d'exercices pret.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
