// Logique de récurrence : détermine si un programme (exercice + planning)
// est "dû" un jour donné, indépendamment du fait qu'il ait été fait ou non.

// Remarque : type assoupli en "string" (plutôt qu'une union littérale stricte) car le champ
// correspondant dans la base (voir schema.prisma) est un simple String -- SQLite ne supporte
// pas les enums natifs. La validation des valeurs autorisées se fait côté API avec zod.
export type RecurrenceType = string;

export interface RecurrenceInput {
  recurrenceType: RecurrenceType;
  daysOfWeek?: string | null; // JSON string ex: "[1,3,5]"
  intervalDays?: number | null;
  timesPerWeek?: number | null; // utilisé si WEEKLY_COUNT
  startDate: Date;
}

// Normalise une date à minuit (UTC) pour comparer uniquement les jours calendaires
export function toDayStart(d: Date): Date {
  const copy = new Date(d);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

export function daysBetween(a: Date, b: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((toDayStart(b).getTime() - toDayStart(a).getTime()) / MS_PER_DAY);
}

// Retourne le lundi (début de semaine) de la semaine contenant `date`
export function weekStart(date: Date): Date {
  const d = toDayStart(date);
  const day = d.getUTCDay(); // 0=dimanche, 1=lundi, ..., 6=samedi
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

export function isDueOnDate(program: RecurrenceInput, date: Date): boolean {
  const day = toDayStart(date);
  const start = toDayStart(program.startDate);

  // Un programme n'est jamais "dû" avant sa date de création
  if (day.getTime() < start.getTime()) return false;

  switch (program.recurrenceType) {
    case "DAILY":
      return true;

    case "WEEKLY": {
      const days: number[] = program.daysOfWeek ? JSON.parse(program.daysOfWeek) : [];
      return days.includes(day.getUTCDay());
    }

    case "EVERY_N_DAYS": {
      const interval = program.intervalDays && program.intervalDays > 0 ? program.intervalDays : 1;
      const diff = daysBetween(start, day);
      return diff % interval === 0;
    }

    case "WEEKLY_COUNT":
      // "X fois par semaine, n'importe quel jour" : tous les jours sont candidats,
      // c'est au niveau de l'affichage (voir today.ts) qu'on masque une fois le quota
      // hebdomadaire atteint.
      return true;

    default:
      return false;
  }
}

// Calcule la "régularité" (streak) : nombre de jours consécutifs (en remontant depuis aujourd'hui)
// où l'exercice était dû et a bien été complété. On s'arrête au premier jour de manque.
// Les jours marqués comme "repos justifié" (restDates) sont neutres : ni un manque, ni une réussite,
// ils n'interrompent pas la série. Ne s'applique pas au type WEEKLY_COUNT (voir computeWeeklyStreak).
export function computeStreak(
  program: RecurrenceInput,
  completedDates: Set<string>, // dates au format YYYY-MM-DD où l'exercice a été complété
  today: Date,
  restDates: Set<string> = new Set()
): number {
  let streak = 0;
  const cursor = toDayStart(today);

  // On remonte jour par jour, en ignorant les jours où l'exercice n'était pas prévu
  // mais en cassant la série dès qu'un jour prévu n'a pas été fait (sauf jour de repos justifié).
  for (let i = 0; i < 3650; i++) {
    const d = new Date(cursor);
    d.setUTCDate(d.getUTCDate() - i);
    if (d.getTime() < toDayStart(program.startDate).getTime()) break;

    const key = d.toISOString().slice(0, 10);
    if (restDates.has(key)) continue; // jour neutre, on passe au suivant sans casser la série

    if (isDueOnDate(program, d)) {
      if (completedDates.has(key)) {
        streak++;
      } else {
        // Si c'est aujourd'hui et pas encore fait, on ne casse pas la série
        // (la journée n'est pas terminée), on continue juste sans incrémenter.
        if (i === 0) continue;
        break;
      }
    }
  }
  return streak;
}

// Compte le nombre de completions dans la semaine commençant à `ws` (lundi), en ne
// regardant pas au-delà d'aujourd'hui.
function countInWeek(ws: Date, completedDates: Set<string>, today: Date): number {
  let count = 0;
  const todayStart = toDayStart(today);
  for (let i = 0; i < 7; i++) {
    const d = new Date(ws);
    d.setUTCDate(d.getUTCDate() + i);
    if (d.getTime() > todayStart.getTime()) break;
    if (completedDates.has(d.toISOString().slice(0, 10))) count++;
  }
  return count;
}

// Équivalent de dueCount/doneCount mais à la semaine (pour le type WEEKLY_COUNT) :
// chaque semaine écoulée depuis le début du programme est une unité "due", réussie si
// le nombre de séances cette semaine-là atteint le quota fixé.
export function computeWeeklyDueDone(
  timesPerWeek: number,
  startDate: Date,
  completedDates: Set<string>,
  today: Date
): { dueCount: number; doneCount: number } {
  const start = weekStart(startDate);
  const currentWeekStart = weekStart(today);
  let dueCount = 0;
  let doneCount = 0;
  const cursor = new Date(start);
  while (cursor.getTime() <= currentWeekStart.getTime()) {
    dueCount++;
    if (countInWeek(cursor, completedDates, today) >= timesPerWeek) doneCount++;
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return { dueCount, doneCount };
}

// Nombre de semaines consécutives (en remontant depuis la semaine courante) où le quota
// hebdomadaire a été atteint. La semaine en cours n'est jamais considérée comme "cassée"
// tant qu'elle n'est pas terminée : si le quota n'est pas encore atteint, on l'ignore
// simplement (elle ne compte pas encore, mais ne casse rien) et on regarde la précédente.
export function computeWeeklyStreak(
  timesPerWeek: number,
  startDate: Date,
  completedDates: Set<string>,
  today: Date
): number {
  const currentWeekStart = weekStart(today);
  const startWeek = weekStart(startDate);
  let streak = 0;
  let cursor = new Date(currentWeekStart);

  if (countInWeek(cursor, completedDates, today) >= timesPerWeek) {
    streak++;
  }
  cursor.setUTCDate(cursor.getUTCDate() - 7);

  for (let i = 0; i < 520; i++) {
    if (cursor.getTime() < startWeek.getTime()) break;
    if (countInWeek(cursor, completedDates, today) >= timesPerWeek) {
      streak++;
      cursor.setUTCDate(cursor.getUTCDate() - 7);
    } else {
      break;
    }
  }
  return streak;
}
