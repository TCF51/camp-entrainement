import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "../api/client";
import StampGrid from "../components/StampGrid";
import { computeDueDates } from "../lib/recurrence";
import type { Program } from "../components/ProgramForm";

interface ProgressData {
  program: Program & { startDate: string };
  history: { date: string; setsDone: number; valueDone: number }[];
  streak: number;
  dueCount: number;
  doneCount: number;
  regularityRate: number;
}

export default function Progress() {
  const { id: campId, exerciseId } = useParams<{ id: string; exerciseId: string }>();
  const [data, setData] = useState<ProgressData | null>(null);
  const [exerciseName, setExerciseName] = useState("");
  const [unit, setUnit] = useState<"REPS" | "SECONDS">("REPS");

  useEffect(() => {
    if (!campId || !exerciseId) return;
    api
      .get<ProgressData>(`/progress/exercise?campId=${campId}&exerciseId=${exerciseId}`)
      .then(setData);
    api.get<{ exercises: { exercise: { id: string; name: string; unit: "REPS" | "SECONDS" } }[] }>(
      `/camps/${campId}`
    ).then((camp) => {
      const exo = camp.exercises.find((e) => e.exercise.id === exerciseId)?.exercise;
      if (exo) {
        setExerciseName(exo.name);
        setUnit(exo.unit);
      }
    });
  }, [campId, exerciseId]);

  if (!data) return <p className="text-muted">Chargement...</p>;

  const completedDates = new Set(data.history.map((h) => h.date));
  const dueDates = computeDueDates(data.program, 84);
  const unitLabel = unit === "REPS" ? "repetitions" : "secondes";

  return (
    <div className="max-w-2xl">
      <Link to={`/camps/${campId}`} className="text-sm text-muted hover:text-accent">
        ← Retour au camp
      </Link>

      <h1 className="font-display text-3xl uppercase tracking-wide mt-2 mb-1">{exerciseName}</h1>
      <p className="text-muted text-sm mb-6">Ta progression et ta regularite, pas de classement, juste toi.</p>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-surface border border-border rounded-xl p-4 text-center">
          <p className="font-display text-3xl text-accent">{data.streak}</p>
          <p className="text-xs text-muted uppercase tracking-wide mt-1">Jours d'affilee</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 text-center">
          <p className="font-display text-3xl text-success">{data.regularityRate}%</p>
          <p className="text-xs text-muted uppercase tracking-wide mt-1">Regularite</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 text-center">
          <p className="font-display text-3xl">
            {data.doneCount}/{data.dueCount}
          </p>
          <p className="text-xs text-muted uppercase tracking-wide mt-1">Seances faites</p>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-5 mb-6">
        <h2 className="font-display uppercase tracking-wide text-sm mb-3">Carte de pointage (12 dernieres semaines)</h2>
        <StampGrid completedDates={completedDates} dueDates={dueDates} days={84} />
        <div className="flex gap-4 mt-3 text-xs text-muted">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm inline-block stamp-cell done" /> Fait
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm inline-block stamp-cell missed" /> Manque
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm inline-block stamp-cell future" /> Non prevu
          </span>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-5">
        <h2 className="font-display uppercase tracking-wide text-sm mb-3">
          Evolution ({unitLabel} par serie realisees)
        </h2>
        {data.history.length === 0 ? (
          <p className="text-muted text-sm">Pas encore de donnees, valide ta premiere seance dans "Aujourd'hui".</p>
        ) : (
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={data.history}>
                <CartesianGrid stroke="#2E323A" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="#8B909A" tick={{ fontSize: 11 }} />
                <YAxis stroke="#8B909A" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1D2025", border: "1px solid #2E323A", fontSize: 12 }}
                  labelStyle={{ color: "#F4F2EC" }}
                />
                <Line type="monotone" dataKey="valueDone" stroke="#FF4B2E" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
