import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";

interface CalendarDay {
  date: string;
  due: boolean;
  done: boolean;
  rest: boolean;
}

function monthLabel(monthStr: string): string {
  const [y, m] = monthStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function shiftMonth(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function CampCalendar() {
  const { id: campId } = useParams<{ id: string }>();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [days, setDays] = useState<CalendarDay[] | null>(null);
  const [campName, setCampName] = useState("");

  useEffect(() => {
    if (!campId) return;
    api.get<{ name: string }>(`/camps/${campId}`).then((c) => setCampName(c.name));
  }, [campId]);

  useEffect(() => {
    if (!campId) return;
    setDays(null);
    api.get<{ days: CalendarDay[] }>(`/camps/${campId}/calendar?month=${month}`).then((res) => setDays(res.days));
  }, [campId, month]);

  // Decalage pour que la grille commence un lundi (0=dimanche -> on veut lundi en premier)
  const firstDay = days && days.length > 0 ? new Date(days[0].date) : null;
  const leadingBlanks = firstDay ? (firstDay.getUTCDay() + 6) % 7 : 0;

  return (
    <div className="max-w-lg">
      <Link to={`/camps/${campId}`} className="text-sm text-muted hover:text-accent">
        ← Retour au camp
      </Link>
      <h1 className="font-display text-3xl uppercase tracking-wide mt-2 mb-4">Calendrier · {campName}</h1>

      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setMonth((m) => shiftMonth(m, -1))} className="text-muted hover:text-accent px-2">
          ← Precedent
        </button>
        <p className="font-display uppercase tracking-wide">{monthLabel(month)}</p>
        <button onClick={() => setMonth((m) => shiftMonth(m, 1))} className="text-muted hover:text-accent px-2">
          Suivant →
        </button>
      </div>

      {days === null ? (
        <p className="text-muted text-sm">Chargement...</p>
      ) : (
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
              <p key={d} className="text-center text-[10px] text-muted uppercase">
                {d}
              </p>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {days.map((day) => {
              const dayNum = Number(day.date.slice(8, 10));
              let cellClass = "border-dashed border-border text-muted"; // pas prevu / futur
              if (day.rest) cellClass = "bg-surface2 border-border text-muted";
              else if (day.done) cellClass = "stamp-cell done";
              else if (day.due) cellClass = "stamp-cell missed";
              return (
                <div
                  key={day.date}
                  title={day.date}
                  className={`aspect-square rounded flex items-center justify-center text-xs border ${cellClass}`}
                >
                  {day.rest ? "😴" : dayNum}
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-4 text-xs text-muted flex-wrap">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm inline-block stamp-cell done" /> Fait
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm inline-block stamp-cell missed" /> Manque
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm inline-block bg-surface2 border border-border" /> Repos
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
