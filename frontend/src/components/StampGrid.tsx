interface Props {
  // dates au format YYYY-MM-DD ou l'exercice a ete valide
  completedDates: Set<string>;
  // dates au format YYYY-MM-DD ou l'exercice etait prevu (du)
  dueDates: Set<string>;
  days?: number; // nombre de jours a afficher (defaut 84 = 12 semaines)
}

// Grille "carte de pointage" : chaque case est un jour. Vert = fait, rouge pale = manque, gris pointille = pas prevu / futur.
// C'est l'element signature de l'app : ca rend visible la regularite d'un coup d'oeil, sans notion de classement.
export default function StampGrid({ completedDates, dueDates, days = 84 }: Props) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const cells: { key: string; status: "done" | "missed" | "future" | "not-due" }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    let status: "done" | "missed" | "future" | "not-due" = "not-due";
    if (dueDates.has(key)) {
      status = completedDates.has(key) ? "done" : i === 0 ? "not-due" : "missed";
    }
    cells.push({ key, status });
  }

  return (
    <div className="inline-grid grid-flow-col grid-rows-7 gap-1" role="img" aria-label="Historique de regularite">
      {cells.map((cell) => (
        <div
          key={cell.key}
          title={cell.key}
          className={`stamp-cell w-3 h-3 md:w-3.5 md:h-3.5 ${
            cell.status === "done" ? "done" : cell.status === "missed" ? "missed" : "future"
          }`}
        />
      ))}
    </div>
  );
}
