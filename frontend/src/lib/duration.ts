// Convertit un nombre total de secondes en affichage "mm:ss"
export function secondsToMMSS(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Convertit minutes + secondes en un total de secondes
export function mmssToSeconds(minutes: number, seconds: number): number {
  return Math.max(0, minutes) * 60 + Math.max(0, Math.min(59, seconds));
}

// Decompose un total de secondes en {minutes, seconds}, pratique pour prefiller deux champs
export function splitSeconds(totalSeconds: number): { minutes: number; seconds: number } {
  return { minutes: Math.floor(totalSeconds / 60), seconds: totalSeconds % 60 };
}
