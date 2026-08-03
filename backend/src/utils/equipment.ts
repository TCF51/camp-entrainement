export const EQUIPMENT_CATALOG = [
  { key: "AUCUN", label: "Aucun materiel (poids du corps)" },
  { key: "HALTERES", label: "Halteres / poids libres" },
  { key: "BARRE_TRACTION", label: "Barre de traction" },
  { key: "ELASTIQUE", label: "Elastique de resistance" },
  { key: "BANC", label: "Banc de musculation" },
  { key: "KETTLEBELL", label: "Kettlebell" },
  { key: "CORDE_A_SAUTER", label: "Corde a sauter" },
  { key: "TAPIS", label: "Tapis de sol" },
  { key: "VELO", label: "Velo / home trainer" },
  { key: "AUTRE", label: "Autre materiel specifique" },
];

export const EQUIPMENT_KEYS = EQUIPMENT_CATALOG.map((e) => e.key);
