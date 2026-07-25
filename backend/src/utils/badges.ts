import { prisma } from "../lib/prisma";
import { toDayStart } from "./recurrence";

// Catalogue des badges disponibles. Purement individuel : aucune comparaison entre utilisateurs.
export interface BadgeDefinition {
  key: string;
  name: string;
  description: string;
  emoji: string;
}

export const BADGE_CATALOG: BadgeDefinition[] = [
  { key: "STREAK_3", name: "3 jours d'affilee", description: "Une seance realisee chaque jour, 3 jours de suite.", emoji: "🔥" },
  { key: "STREAK_7", name: "1 semaine reguliere", description: "Une seance realisee chaque jour, 7 jours de suite.", emoji: "🔥" },
  { key: "STREAK_30", name: "1 mois de regularite", description: "Une seance realisee chaque jour, 30 jours de suite.", emoji: "🏅" },
  { key: "STREAK_100", name: "100 jours de suite", description: "Une seance realisee chaque jour, 100 jours de suite.", emoji: "🏆" },
  { key: "TOTAL_10", name: "10 seances", description: "10 seances validees au total.", emoji: "✅" },
  { key: "TOTAL_50", name: "50 seances", description: "50 seances validees au total.", emoji: "⭐" },
  { key: "TOTAL_100", name: "100 seances", description: "100 seances validees au total.", emoji: "🌟" },
  { key: "TOTAL_500", name: "500 seances", description: "500 seances validees au total.", emoji: "💎" },
];

const STREAK_THRESHOLDS: [number, string][] = [
  [100, "STREAK_100"],
  [30, "STREAK_30"],
  [7, "STREAK_7"],
  [3, "STREAK_3"],
];

const TOTAL_THRESHOLDS: [number, string][] = [
  [500, "TOTAL_500"],
  [100, "TOTAL_100"],
  [50, "TOTAL_50"],
  [10, "TOTAL_10"],
];

// Calcule le plus long "streak" en cours (jours consecutifs avec au moins une seance,
// tous camps/exercices confondus), en remontant depuis aujourd'hui ou hier.
function computeGlobalStreak(distinctDates: Set<string>, today: Date): number {
  const start = toDayStart(today);
  // Si rien n'est fait aujourd'hui, on tolere et on part d'hier pour ne pas casser la serie
  // en cours de journee.
  let cursor = new Date(start);
  if (!distinctDates.has(cursor.toISOString().slice(0, 10))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  let streak = 0;
  for (let i = 0; i < 3650; i++) {
    const key = cursor.toISOString().slice(0, 10);
    if (!distinctDates.has(key)) break;
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

// Recalcule les stats de l'utilisateur et attribue tout nouveau badge merite.
// Appele apres chaque validation de seance. Idempotent (un badge n'est jamais attribue deux fois).
export async function checkAndAwardBadges(userId: string): Promise<BadgeDefinition[]> {
  const logs = await prisma.exerciseLog.findMany({
    where: { userId },
    select: { date: true },
  });

  const distinctDates = new Set(logs.map((l) => l.date.toISOString().slice(0, 10)));
  const totalSessions = logs.length;
  const streak = computeGlobalStreak(distinctDates, new Date());

  const earnedKeys = new Set<string>();
  // On attribue TOUS les paliers deja franchis (pas seulement le plus haut), pour garder
  // l'historique des badges obtenus meme si la serie casse ensuite.
  for (const [threshold, key] of STREAK_THRESHOLDS) {
    if (streak >= threshold) earnedKeys.add(key);
  }
  for (const [threshold, key] of TOTAL_THRESHOLDS) {
    if (totalSessions >= threshold) earnedKeys.add(key);
  }

  if (earnedKeys.size === 0) return [];

  const alreadyEarned = await prisma.userBadge.findMany({ where: { userId }, select: { badgeKey: true } });
  const alreadyEarnedKeys = new Set(alreadyEarned.map((b) => b.badgeKey));

  const newlyEarned = [...earnedKeys].filter((k) => !alreadyEarnedKeys.has(k));
  if (newlyEarned.length === 0) return [];

  await prisma.userBadge.createMany({
    data: newlyEarned.map((badgeKey) => ({ userId, badgeKey })),
  });

  return BADGE_CATALOG.filter((b) => newlyEarned.includes(b.key));
}
