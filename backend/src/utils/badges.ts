import { prisma } from "../lib/prisma";
import { toDayStart, isDueOnDate, computeWeeklyDueDone } from "./recurrence";

// Catalogue des badges disponibles. Purement individuel : aucune comparaison entre utilisateurs.
export interface BadgeDefinition {
  key: string;
  name: string;
  description: string;
  emoji: string;
}

export const BADGE_CATALOG: BadgeDefinition[] = [
  { key: "STREAK_3", name: "3 jours d'affilee", description: "Une séance réalisée chaque jour, 3 jours de suite.", emoji: "🔥" },
  { key: "STREAK_7", name: "1 semaine régulière", description: "Une séance réalisée chaque jour, 7 jours de suite.", emoji: "🔥" },
  { key: "STREAK_30", name: "1 mois de régularité", description: "Une séance réalisée chaque jour, 30 jours de suite.", emoji: "🏅" },
  { key: "STREAK_100", name: "100 jours de suite", description: "Une séance réalisée chaque jour, 100 jours de suite.", emoji: "🏆" },
  { key: "TOTAL_10", name: "10 séances", description: "10 séances validees au total.", emoji: "✅" },
  { key: "TOTAL_50", name: "50 séances", description: "50 séances validees au total.", emoji: "⭐" },
  { key: "TOTAL_100", name: "100 séances", description: "100 séances validees au total.", emoji: "🌟" },
  { key: "TOTAL_500", name: "500 séances", description: "500 séances validees au total.", emoji: "💎" },
  { key: "MERIT_STAR_BRONZE", name: "Étoile du mérite - Bronze", description: "Au moins 60% de tes séances prévues réalisées (sur au moins 2 semaines suivies).", emoji: "🌟" },
  { key: "MERIT_STAR_SILVER", name: "Étoile du mérite - Argent", description: "Au moins 75% de tes séances prévues réalisées (sur au moins 2 semaines suivies).", emoji: "🌟" },
  { key: "MERIT_STAR_GOLD", name: "Étoile du mérite - Or", description: "Au moins 90% de tes séances prévues réalisées (sur au moins 2 semaines suivies).", emoji: "🥇" },
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

const MERIT_THRESHOLDS: [number, string][] = [
  [90, "MERIT_STAR_GOLD"],
  [75, "MERIT_STAR_SILVER"],
  [60, "MERIT_STAR_BRONZE"],
];
const MERIT_MIN_DUE_COUNT = 14; // au moins ~2 semaines de recul avant d'attribuer une etoile

// Calcule le taux de regularite global de l'utilisateur, tous camps confondus (uniquement
// les camps ou il participe activement, pas ceux ou il est juste "entraineur"). Renvoie
// null si pas assez de recul (moins de MERIT_MIN_DUE_COUNT jours/semaines dus).
export async function computeOverallRegularityRate(userId: string): Promise<number | null> {
  const memberships = await prisma.campMembership.findMany({
    where: { userId, role: { not: "COACH" } },
    include: { camp: { include: { exercises: true, circuits: true } } },
  });
  if (memberships.length === 0) return null;

  const restDays = await prisma.restDay.findMany({ where: { userId }, select: { date: true } });
  const restDates = new Set(restDays.map((r) => r.date.toISOString().slice(0, 10)));
  const today = toDayStart(new Date());

  let totalDue = 0;
  let totalDone = 0;

  for (const membership of memberships) {
    const { camp } = membership;
    const joined = toDayStart(membership.joinedAt);

    for (const ce of [...camp.exercises, ...camp.circuits]) {
      const isCircuit = !("targetSets" in ce);
      const logs = isCircuit
        ? await prisma.campCircuitLog.findMany({ where: { userId, campCircuitId: (ce as any).id }, select: { date: true } })
        : await prisma.exerciseLog.findMany({
            where: { userId, campId: camp.id, exerciseId: (ce as any).exerciseId },
            select: { date: true },
          });
      const completedDates = new Set(logs.map((l) => l.date.toISOString().slice(0, 10)));
      const effectiveStart = toDayStart(new Date(Math.max(new Date(ce.startDate).getTime(), joined.getTime())));

      if (ce.recurrenceType === "WEEKLY_COUNT" && ce.timesPerWeek) {
        const { dueCount, doneCount } = computeWeeklyDueDone(ce.timesPerWeek, effectiveStart, completedDates, today);
        totalDue += dueCount;
        totalDone += doneCount;
      } else {
        const cursor = new Date(effectiveStart);
        while (cursor.getTime() <= today.getTime()) {
          const key = cursor.toISOString().slice(0, 10);
          if (!restDates.has(key) && isDueOnDate(ce, cursor)) {
            totalDue++;
            if (completedDates.has(key)) totalDone++;
          }
          cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
      }
    }
  }

  if (totalDue < MERIT_MIN_DUE_COUNT) return null;
  return Math.round((totalDone / totalDue) * 100);
}

// Calcule le plus long "streak" en cours (jours consecutifs avec au moins une séance,
// tous camps/exercices confondus), en remontant depuis aujourd'hui ou hier. Les jours
// marques comme "repos justifie" sont neutres : ils n'interrompent pas la serie.
function computeGlobalStreak(distinctDates: Set<string>, today: Date, restDates: Set<string> = new Set()): number {
  const start = toDayStart(today);
  // Si rien n'est fait aujourd'hui, on tolere et on part d'hier pour ne pas casser la serie
  // en cours de journee.
  let cursor = new Date(start);
  if (!distinctDates.has(cursor.toISOString().slice(0, 10)) && !restDates.has(cursor.toISOString().slice(0, 10))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  let streak = 0;
  for (let i = 0; i < 3650; i++) {
    const key = cursor.toISOString().slice(0, 10);
    if (restDates.has(key)) {
      cursor.setUTCDate(cursor.getUTCDate() - 1);
      continue;
    }
    if (!distinctDates.has(key)) break;
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

// Recalcule les stats de l'utilisateur et attribue tout nouveau badge merite.
// Appele après chaque validation de séance (exercice, circuit de camp, ou séance chrono libre).
// Idempotent (un badge n'est jamais attribue deux fois).
export async function checkAndAwardBadges(userId: string): Promise<BadgeDefinition[]> {
  const [exerciseLogs, circuitLogs, chronoSessions] = await Promise.all([
    prisma.exerciseLog.findMany({ where: { userId }, select: { date: true } }),
    prisma.campCircuitLog.findMany({ where: { userId }, select: { date: true } }),
    prisma.chronoSession.findMany({ where: { userId }, select: { completedAt: true } }),
  ]);

  const distinctDates = new Set<string>([
    ...exerciseLogs.map((l) => l.date.toISOString().slice(0, 10)),
    ...circuitLogs.map((l) => l.date.toISOString().slice(0, 10)),
    ...chronoSessions.map((s) => s.completedAt.toISOString().slice(0, 10)),
  ]);
  const totalSessions = exerciseLogs.length + circuitLogs.length + chronoSessions.length;
  const restDays = await prisma.restDay.findMany({ where: { userId }, select: { date: true } });
  const restDates = new Set(restDays.map((r) => r.date.toISOString().slice(0, 10)));
  const streak = computeGlobalStreak(distinctDates, new Date(), restDates);

  const earnedKeys = new Set<string>();
  // On attribue TOUS les paliers déjà franchis (pas seulement le plus haut), pour garder
  // l'historique des badges obtenus même si la serie casse ensuite.
  for (const [threshold, key] of STREAK_THRESHOLDS) {
    if (streak >= threshold) earnedKeys.add(key);
  }
  for (const [threshold, key] of TOTAL_THRESHOLDS) {
    if (totalSessions >= threshold) earnedKeys.add(key);
  }

  const overallRate = await computeOverallRegularityRate(userId);
  if (overallRate !== null) {
    for (const [threshold, key] of MERIT_THRESHOLDS) {
      if (overallRate >= threshold) earnedKeys.add(key);
    }
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
