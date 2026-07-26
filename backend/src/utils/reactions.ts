export interface ReactionDefinition {
  key: string;
  label: string;
  emoji: string;
}

// Inspire des chants/rituels de supporters : encourager, pas comparer les performances.
export const REACTION_CATALOG: ReactionDefinition[] = [
  { key: "OVATION", label: "Ovation", emoji: "🙌" },
  { key: "RESPECT", label: "Respect", emoji: "🫡" },
  { key: "HAKA", label: "Haka", emoji: "💥" },
  { key: "OLA", label: "Ola", emoji: "🌊" },
  { key: "HYMNE", label: "Hymne", emoji: "🎶" },
  { key: "CLAPPING", label: "Clapping", emoji: "👏" },
  { key: "TIFO", label: "Tifo", emoji: "🎨" },
  { key: "TAMBOURINAGE", label: "Tambourinage", emoji: "🥁" },
];

export const REACTION_KEYS = REACTION_CATALOG.map((r) => r.key);
