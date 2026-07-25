import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";

interface LeaderboardEntry {
  userId: string;
  name: string;
  regularityRate: number;
  streak: number;
  dueCount: number;
  doneCount: number;
}

export default function CampLeaderboard() {
  const { id: campId } = useParams<{ id: string }>();
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [campName, setCampName] = useState("");

  useEffect(() => {
    if (!campId) return;
    api.get<{ name: string }>(`/camps/${campId}`).then((c) => setCampName(c.name));
    api.get<LeaderboardEntry[]>(`/camps/${campId}/leaderboard`).then(setEntries);
  }, [campId]);

  return (
    <div className="max-w-xl">
      <Link to={`/camps/${campId}`} className="text-sm text-muted hover:text-accent">
        ← Retour au camp
      </Link>
      <h1 className="font-display text-3xl uppercase tracking-wide mt-2 mb-1">Classement · {campName}</h1>
      <p className="text-muted text-sm mb-6">
        Base uniquement sur la regularite (taux de seances realisees et jours consecutifs) — jamais sur la
        performance. L'idee est de s'encourager, pas de se comparer sur qui fait le plus de repetitions.
      </p>

      {entries === null && <p className="text-muted">Chargement...</p>}

      <div className="space-y-2">
        {entries?.map((entry, index) => (
          <div
            key={entry.userId}
            className="bg-surface border border-border rounded-lg p-4 flex items-center gap-4"
          >
            <div className="w-8 h-8 rounded-full bg-surface2 border border-border flex items-center justify-center font-display text-sm shrink-0">
              {index + 1}
            </div>
            <div className="flex-1">
              <p className="font-medium">{entry.name}</p>
              <p className="text-xs text-muted">
                {entry.doneCount} / {entry.dueCount} seances realisees
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-display text-xl text-accent">{entry.regularityRate}%</p>
              <p className="text-[10px] uppercase tracking-wide text-muted">
                {entry.streak} jour{entry.streak > 1 ? "s" : ""} d'affilee
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
