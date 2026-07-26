// Logique de recurrence : determine si un programme (exercice + planning)
// est "du" un jour donne, independamment du fait qu'il ait ete fait ou non.

// Remarque : type assoupli en "string" (plutot qu'une union litterale stricte) car le champ
// correspondant dans la base (voir schema.prisma) est un simple String -- SQLite ne supporte
// pas les enums natifs. La validation des valeurs autorisees se fait cote API avec zod.
export type RecurrenceType = string;

export interface RecurrenceInput {
  recurrenceType: RecurrenceType;
  daysOfWeek?: string | null; // JSON string ex: "[1,3,5]"
  intervalDays?: number | null;
  startDate: Date;
}

// Normalise une date a minuit (UTC) pour comparer uniquement les jours calendaires
export function toDayStart(d: Date): Date {
  const copy = new Date(d);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

export function daysBetween(a: Date, b: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((toDayStart(b).getTime() - toDayStart(a).getTime()) / MS_PER_DAY);
}

export function isDueOnDate(program: RecurrenceInput, date: Date): boolean {
  const day = toDayStart(date);
  const start = toDayStart(program.startDate);

  // Un programme n'est jamais "du" avant sa date de creation
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

    default:
      return false;
  }
}

// Calcule la "regularite" (streak) : nombre de jours consecutifs (en remontant depuis aujourd'hui)
// ou l'exercice etait du et a bien ete complete. On s'arrete au premier jour du manque.
// Les jours marques comme "repos justifie" (restDates) sont neutres : ni un manque, ni une reussite,
// ils n'interrompent pas la serie.
export function computeStreak(
  program: RecurrenceInput,
  completedDates: Set<string>, // dates au format YYYY-MM-DD ou l'exercice a ete complete
  today: Date,
  restDates: Set<string> = new Set()
): number {
  let streak = 0;
  const cursor = toDayStart(today);

  // On remonte jour par jour, en ignorant les jours ou l'exercice n'etait pas prevu
  // mais en cassant la serie des qu'un jour prevu n'a pas ete fait (sauf jour de repos justifie).
  for (let i = 0; i < 3650; i++) {
    const d = new Date(cursor);
    d.setUTCDate(d.getUTCDate() - i);
    if (d.getTime() < toDayStart(program.startDate).getTime()) break;

    const key = d.toISOString().slice(0, 10);
    if (restDates.has(key)) continue; // jour neutre, on passe au suivant sans casser la serie

    if (isDueOnDate(program, d)) {
      if (completedDates.has(key)) {
        streak++;
      } else {
        // Si c'est aujourd'hui et pas encore fait, on ne casse pas la serie
        // (la journee n'est pas terminee), on continue juste sans incrementer.
        if (i === 0) continue;
        break;
      }
    }
  }
  return streak;
}
