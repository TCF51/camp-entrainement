import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import ProgramForm, { Program } from "../components/ProgramForm";
import type { Exercise } from "../components/ExercisePicker";

interface CampDetailData {
  id: string;
  name: string;
  code: string;
  startDate: string | null;
  endDate: string | null;
  exercises: { exercise: Exercise }[];
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
  const [camp, setCamp] = useState<CampDetailData | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);

  function load() {
    if (!id) return;
    api.get<CampDetailData>(`/camps/${id}`).then(setCamp);
    api.get<Program[]>(`/programs?campId=${id}`).then(setPrograms);
  }
  useEffect(load, [id]);

  if (!camp) return <p className="text-muted">Chargement...</p>;

  const programByExercise = new Map(programs.map((p) => [p.exerciseId, p]));

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

      <h2 className="font-display uppercase tracking-wide text-lg mt-8 mb-3">Mes exercices dans ce camp</h2>
      <p className="text-muted text-sm mb-4">
        Configure combien de series/repetitions tu veux faire, et a quelle frequence.
      </p>

      <div className="space-y-3">
        {camp.exercises.map(({ exercise }) => {
          const program = programByExercise.get(exercise.id);
          const isEditing = editingExerciseId === exercise.id;

          if (isEditing) {
            return (
              <ProgramForm
                key={exercise.id}
                campId={camp.id}
                exerciseId={exercise.id}
                exerciseName={exercise.name}
                unit={exercise.unit}
                existing={program}
                onSaved={() => {
                  setEditingExerciseId(null);
                  load();
                }}
                onCancel={() => setEditingExerciseId(null)}
              />
            );
          }

          return (
            <div
              key={exercise.id}
              className="bg-surface border border-border rounded-lg p-4 flex items-center justify-between flex-wrap gap-3"
            >
              <div>
                <p className="font-medium">{exercise.name}</p>
                {program ? (
                  <p className="text-sm text-muted">
                    {program.targetMode === "MAX"
                      ? `${program.targetSets} serie${program.targetSets > 1 ? "s" : ""} a fond`
                      : `${program.targetSets} x ${program.targetValue} ${exercise.unit === "REPS" ? "reps" : "sec"}`}{" "}
                    · {RECURRENCE_LABEL[program.recurrenceType](program)}
                  </p>
                ) : (
                  <p className="text-sm text-muted italic">Pas encore configure</p>
                )}
              </div>
              <div className="flex gap-3 items-center">
                {program && (
                  <Link
                    to={`/camps/${camp.id}/progression/${exercise.id}`}
                    className="text-sm text-accent hover:text-accentSoft"
                  >
                    Progression
                  </Link>
                )}
                <button
                  onClick={() => setEditingExerciseId(exercise.id)}
                  className="text-sm bg-surface2 hover:bg-border transition-colors border border-border rounded-md px-3 py-1.5"
                >
                  {program ? "Modifier" : "Configurer"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
