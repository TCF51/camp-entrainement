// Liste large : sports collectifs, individuels, et activites de forme/bien-etre.
export const SPORTS_LIST = [
  "Football",
  "Rugby",
  "Basketball",
  "Handball",
  "Volleyball",
  "Tennis",
  "Badminton",
  "Natation",
  "Athletisme",
  "Course a pied",
  "Cyclisme / Velo",
  "Musculation",
  "Escalade",
  "Marche / Randonnee",
  "Gymnastique d'entretien",
  "Arts martiaux / Sports de combat",
  "Danse",
  "Ski / Sports d'hiver",
  "Crossfit",
  "Yoga / Pilates",
  "Preparation physique (pompiers, armee, police...)",
  "Autre",
];

export const SPORT_LEVELS: { value: "LOISIR" | "COMPETITION"; label: string }[] = [
  { value: "LOISIR", label: "Loisir / bien-etre, pour le plaisir" },
  { value: "COMPETITION", label: "Competition" },
];
