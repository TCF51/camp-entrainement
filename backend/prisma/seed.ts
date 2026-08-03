// Peuple la base avec un catalogue d'exercices "de base" a choix large, classes par
// categorie et materiel necessaire. Lancer avec : npm run seed
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Category = "UPPER" | "LOWER" | "ABS" | "CARDIO" | "FULL_BODY" | "MOBILITY";

interface SeedExercise {
  name: string;
  description: string;
  unit: "REPS" | "SECONDS";
  category: Category;
  equipment: string[]; // cles du catalogue materiel (voir src/utils/equipment.ts), [] = aucun
}

const DEFAULT_EXERCISES: SeedExercise[] = [
  { name: "Pompes", description: "Pompes classiques, poitrine proche du sol.", unit: "REPS", category: "UPPER", equipment: [] },
  { name: "Chaise contre le mur", description: "Dos au mur, cuisses a l'horizontale, on tient.", unit: "SECONDS", category: "LOWER", equipment: [] },
  { name: "Gainage planche", description: "Gainage ventral sur les avant-bras, corps aligne.", unit: "SECONDS", category: "ABS", equipment: [] },
  { name: "Gainage laterale (par cote)", description: "Gainage sur un avant-bras, corps de profil.", unit: "SECONDS", category: "ABS", equipment: [] },
  { name: "Squats", description: "Flexion des jambes, dos droit, cuisses paralleles au sol.", unit: "REPS", category: "LOWER", equipment: [] },
  { name: "Fentes avant (par jambe)", description: "Fentes alternees, genou arriere proche du sol.", unit: "REPS", category: "LOWER", equipment: [] },
  { name: "Tractions", description: "Tractions en pronation ou supination a la barre.", unit: "REPS", category: "UPPER", equipment: ["BARRE_TRACTION"] },
  { name: "Dips", description: "Extension des bras sur barres paralleles ou banc.", unit: "REPS", category: "UPPER", equipment: ["BANC"] },
  { name: "Abdominaux (crunchs)", description: "Releves de buste, mains aux tempes ou croisees.", unit: "REPS", category: "ABS", equipment: [] },
  { name: "Mountain climbers", description: "Genoux ramenes alternativement en position de planche.", unit: "REPS", category: "CARDIO", equipment: [] },
  { name: "Burpees", description: "Squat, planche, pompe, saut : enchainement complet.", unit: "REPS", category: "FULL_BODY", equipment: [] },
  { name: "Corde a sauter", description: "Sauts a la corde, rythme regulier.", unit: "SECONDS", category: "CARDIO", equipment: ["CORDE_A_SAUTER"] },
  { name: "Superman (extension dorsale)", description: "Allonge sur le ventre, on souleve bras et jambes.", unit: "SECONDS", category: "ABS", equipment: [] },
  { name: "Course a pied", description: "Footing ou fractionne, en minutes converties en secondes.", unit: "SECONDS", category: "CARDIO", equipment: [] },
  { name: "Montee de genoux sur place", description: "Genoux montes alternativement le plus haut possible.", unit: "REPS", category: "CARDIO", equipment: [] },
  { name: "Developpe couche halteres", description: "Couche sur banc, pousser les halteres au-dessus de la poitrine.", unit: "REPS", category: "UPPER", equipment: ["HALTERES", "BANC"] },
  { name: "Rowing haltere", description: "Buste incline, tirer l'haltere vers la hanche.", unit: "REPS", category: "UPPER", equipment: ["HALTERES"] },
  { name: "Curl biceps", description: "Flexion des coudes, halteres en mains.", unit: "REPS", category: "UPPER", equipment: ["HALTERES"] },
  { name: "Souleve de terre kettlebell", description: "Charniere de hanche, dos plat, kettlebell au sol.", unit: "REPS", category: "LOWER", equipment: ["KETTLEBELL"] },
  { name: "Swing kettlebell", description: "Balancer explosif de la kettlebell entre les jambes puis devant soi.", unit: "REPS", category: "FULL_BODY", equipment: ["KETTLEBELL"] },
  { name: "Elastique tirage horizontal", description: "Tirer l'elastique vers soi, coudes proches du corps.", unit: "REPS", category: "UPPER", equipment: ["ELASTIQUE"] },
  { name: "Velo (home trainer)", description: "Pedalage a rythme regulier ou fractionne.", unit: "SECONDS", category: "CARDIO", equipment: ["VELO"] },
  { name: "Etirements complets", description: "Sequence d'etirements des principaux groupes musculaires.", unit: "SECONDS", category: "MOBILITY", equipment: ["TAPIS"] },
  { name: "Mobilite des hanches", description: "Cercles de hanches et ouvertures dynamiques.", unit: "SECONDS", category: "MOBILITY", equipment: [] },
  { name: "Gainage dynamique (mountain climber lent)", description: "Planche avec genoux qui viennent toucher le coude, rythme controle.", unit: "REPS", category: "ABS", equipment: [] },
];

async function main() {
  for (const exo of DEFAULT_EXERCISES) {
    const existing = await prisma.exercise.findFirst({ where: { name: exo.name, isCustom: false } });
    const data = {
      name: exo.name,
      description: exo.description,
      unit: exo.unit,
      category: exo.category,
      equipment: JSON.stringify(exo.equipment),
      isCustom: false,
    };
    if (!existing) {
      await prisma.exercise.create({ data });
      console.log(`Exercice cree : ${exo.name}`);
    } else if (!existing.category) {
      // Complete la categorie/le materiel sur les exercices deja crees avant cette mise a jour
      await prisma.exercise.update({ where: { id: existing.id }, data: { category: exo.category, equipment: data.equipment } });
      console.log(`Exercice mis a jour (categorie) : ${exo.name}`);
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
