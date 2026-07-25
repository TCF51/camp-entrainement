// Reprend la meme logique que le backend (src/utils/recurrence.ts) pour savoir,
// cote client, si un programme etait "du" un jour donne. Utile pour dessiner la
// grille de regularite sans faire un appel serveur par jour.

export interface RecurrenceInput {
  recurrenceType: "DAILY" | "WEEKLY" | "EVERY_N_DAYS";
  daysOfWeek?: string | null;
  intervalDays?: number | null;
  startDate: string | Date;
}

function toDayStart(d: Date): Date {
  const copy = new Date(d);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function daysBetween(a: Date, b: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((toDayStart(b).getTime() - toDayStart(a).getTime()) / MS_PER_DAY);
}

export function isDueOnDate(program: RecurrenceInput, date: Date): boolean {
  const day = toDayStart(date);
  const start = toDayStart(new Date(program.startDate));
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
      return daysBetween(start, day) % interval === 0;
    }
    default:
      return false;
  }
}

// Renvoie l'ensemble des dates (YYYY-MM-DD) dues sur les N derniers jours
export function computeDueDates(program: RecurrenceInput, days: number): Set<string> {
  const today = toDayStart(new Date());
  const dues = new Set<string>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    if (isDueOnDate(program, d)) dues.add(d.toISOString().slice(0, 10));
  }
  return dues;
}
