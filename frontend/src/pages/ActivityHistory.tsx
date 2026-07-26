import { useEffect, useState } from "react";
import { api } from "../api/client";
import { secondsToMMSS } from "../lib/duration";

interface Stats {
  totalSessions: number;
  totalPracticeSeconds: number;
  exerciseCount: number;
  personalBests: { exerciseName: string; unit: string; best: number }[];
}

type ActivityItem =
  | { type: "exercise"; date: string; exerciseName: string; unit: "REPS" | "SECONDS"; campName: string; setsDone: number; valueDone: number }
  | { type: "circuit"; date: string; circuitName: string; campName: string; durationSeconds: number }
  | { type: "chrono"; date: string; name: string | null; items: string[]; totalDurationSeconds: number; rounds: number };

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.round((totalSeconds % 3600) / 60);
  if (h === 0) return `${m} min`;
  return `${h} h ${m.toString().padStart(2, "0")}`;
}

export default function ActivityHistory() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [items, setItems] = useState<ActivityItem[] | null>(null);

  useEffect(() => {
    api.get<{ stats: Stats; items: ActivityItem[] }>("/activity").then((res) => {
      setStats(res.stats);
      setItems(res.items);
    });
  }, []);

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl uppercase tracking-wide mb-1">Mon historique</h1>
      <p className="text-muted text-sm mb-6">Toutes tes seances, tous camps et circuits confondus.</p>

      {stats && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-surface border border-border rounded-xl p-4 text-center">
            <p className="font-display text-2xl text-accent">{stats.totalSessions}</p>
            <p className="text-[10px] text-muted uppercase tracking-wide mt-1">Seances au total</p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4 text-center">
            <p className="font-display text-2xl text-accent">{formatDuration(stats.totalPracticeSeconds)}</p>
            <p className="text-[10px] text-muted uppercase tracking-wide mt-1">Temps de pratique</p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4 text-center">
            <p className="font-display text-2xl text-accent">{stats.exerciseCount}</p>
            <p className="text-[10px] text-muted uppercase tracking-wide mt-1">Exercices differents</p>
          </div>
        </div>
      )}

      {stats && stats.personalBests.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-4 mb-6">
          <h2 className="font-display uppercase tracking-wide text-sm mb-3">Records personnels (sur une serie)</h2>
          <div className="grid sm:grid-cols-2 gap-2">
            {stats.personalBests.map((pb) => (
              <div key={pb.exerciseName} className="flex items-center justify-between text-sm">
                <span className="text-muted">{pb.exerciseName}</span>
                <span className="font-mono text-accent">
                  {pb.unit === "SECONDS" ? secondsToMMSS(pb.best) : `${pb.best} reps`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="font-display uppercase tracking-wide text-sm mb-3">Journal des seances</h2>

      {items === null && <p className="text-muted">Chargement...</p>}
      {items?.length === 0 && <p className="text-muted text-sm">Aucune seance enregistree pour l'instant.</p>}

      <div className="space-y-2">
        {items?.map((item, index) => (
          <div key={index} className="bg-surface border border-border rounded-lg p-3 flex items-center justify-between gap-3">
            <div>
              {item.type === "exercise" && (
                <>
                  <p className="text-sm font-medium">{item.exerciseName}</p>
                  <p className="text-xs text-muted">
                    {item.campName} · {item.setsDone} x{" "}
                    {item.unit === "SECONDS" ? secondsToMMSS(item.valueDone) : `${item.valueDone} reps`}
                  </p>
                </>
              )}
              {item.type === "circuit" && (
                <>
                  <p className="text-sm font-medium">🔁 {item.circuitName}</p>
                  <p className="text-xs text-muted">
                    {item.campName} · {formatDuration(item.durationSeconds)}
                  </p>
                </>
              )}
              {item.type === "chrono" && (
                <>
                  <p className="text-sm font-medium">⏱ {item.name || "Circuit libre"}</p>
                  <p className="text-xs text-muted">
                    {item.items.join(", ")} · {item.rounds} tour{item.rounds > 1 ? "s" : ""} ·{" "}
                    {formatDuration(item.totalDurationSeconds)}
                  </p>
                </>
              )}
            </div>
            <p className="text-xs text-muted shrink-0">
              {new Date(item.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
