import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import ProgramForm, { Program } from "../components/ProgramForm";
import { secondsToMMSS } from "../lib/duration";

interface CampExerciseData extends Program {
  exercise: { id: string; name: string; unit: "REPS" | "SECONDS"; description: string | null };
}

interface CampDetailData {
  id: string;
  name: string;
  code: string;
  createdById: string;
  startDate: string | null;
  endDate: string | null;
  exercises: CampExerciseData[];
  members: { user: { id: string; name: string } }[];
}

const RECURRENCE_LABEL: Record<string, (p: Program) => string> = {
  DAILY: () => "Tous les jours",
  WEEKLY: (p) => {
    const days = p.daysOfWeek ? (JSON.parse(p.daysOfWeek) as number[]) : [];
    const names = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    return days.map((d) => names[d]).join(", ");
  },
  EVERY_N_DAYS: (p) => `Tous les ${p.intervalDays} jours`,
};

export default function CampDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [camp, setCamp] = useState<CampDetailData | null>(null);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);

  function load() {
    if (!id) return;
    api.get<CampDetailData>(`/camps/${id}`).then(setCamp);
  }
  useEffect(load, [id]);

  if (!camp) return <p className="text-muted">Chargement...</p>;

  const isCoach = user?.id === camp.createdById;

  return (
    <div className="max-w-2xl">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-2">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-wide">{camp.name}</h1>
          <p className="text-muted text-sm">
            {camp.members.length} membre{camp.members.length > 1 ? "s" : ""} :{" "}
            {camp.members.map((m) => m.user.name).join(", ")}
          </p>
          {(camp.startDate || camp.endDate) && (
            <p className="text-muted text-xs mt-1">
              {camp.startDate ? `Du ${new Date(camp.startDate).toLocaleDateString("fr-FR")}` : "Sans date de debut"}
              {camp.endDate ? ` au ${new Date(camp.endDate).toLocaleDateString("fr-FR")}` : ""}
            </p>
          )}
        </div>
        <div className="bg-surface border border-border rounded-md px-3 py-2 text-center">
          <p className="text-[10px] uppercase tracking-widest text-muted">Code</p>
          <p className="font-mono text-lg text-accent">{camp.code}</p>
        </div>
      </div>

      <Link
        to={`/camps/${camp.id}/discussion`}
        className="inline-block mt-2 text-sm text-accent hover:text-accentSoft"
      >
        💬 Discussion du camp
      </Link>

      <h2 className="font-display uppercase tracking-wide text-lg mt-8 mb-1">Exercices du camp</h2>
      <p className="text-muted text-sm mb-4">
        {isCoach
          ? "En tant que createur du camp, tu definis la consigne (objectif, frequence) suivie par tous les membres."
          : "Consignes definies par le createur du camp."}
      </p>

      <div className="space-y-3">
        {camp.exercises.map((ce) => {
          const isEditing = editingExerciseId === ce.exercise.id;

          if (isEditing) {
            return (
              <ProgramForm
                key={ce.exercise.id}
                campId={camp.id}
                exerciseId={ce.exercise.id}
                exerciseName={ce.exercise.name}
                unit={ce.exercise.unit}
                existing={ce}
                onSaved={() => {
                  setEditingExerciseId(null);
                  load();
                }}
                onCancel={() => setEditingExerciseId(null)}
              />
            );
          }

          const unitLabel = ce.exercise.unit === "REPS" ? "reps" : "";
          const valueLabel =
            ce.exercise.unit === "SECONDS" && ce.targetValue != null
              ? secondsToMMSS(ce.targetValue)
              : `${ce.targetValue} ${unitLabel}`;

          return (
            <div key={ce.exercise.id} className="bg-surface border border-border rounded-lg p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="font-medium">{ce.exercise.name}</p>
                  <p className="text-sm text-muted">
                    {ce.targetMode === "MAX"
                      ? `${ce.targetSets} serie${ce.targetSets > 1 ? "s" : ""} a fond`
                      : `${ce.targetSets} x ${valueLabel}`}{" "}
                    · {RECURRENCE_LABEL[ce.recurrenceType](ce)}
                  </p>
                  {ce.description && <p className="text-xs text-muted mt-1 italic">"{ce.description}"</p>}
                </div>
                <div className="flex gap-3 items-center shrink-0">
                  <Link
                    to={`/camps/${camp.id}/progression/${ce.exercise.id}`}
                    className="text-sm text-accent hover:text-accentSoft"
                  >
                    Progression
                  </Link>
                  {isCoach && (
                    <button
                      onClick={() => setEditingExerciseId(ce.exercise.id)}
                      className="text-sm bg-surface2 hover:bg-border transition-colors border border-border rounded-md px-3 py-1.5"
                    >
                      Modifier
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
