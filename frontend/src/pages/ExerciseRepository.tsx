import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";

interface ExerciseStat {
  id: string;
  name: string;
  description: string | null;
  unit: "REPS" | "SECONDS";
  isCustom: boolean;
  campCount: number;
}

export default function ExerciseRepository() {
  const [exercises, setExercises] = useState<ExerciseStat[] | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.get<ExerciseStat[]>("/exercises/stats").then(setExercises);
  }, []);

  const filtered = useMemo(() => {
    if (!exercises) return [];
    const sorted = [...exercises].sort((a, b) => b.campCount - a.campCount);
    return sorted.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()));
  }, [exercises, search]);

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl uppercase tracking-wide mb-1">Repertoire d'exercices</h1>
      <p className="text-muted text-sm mb-6">
        Tout le catalogue disponible, avec le nombre de camps qui utilisent chaque exercice (tous les camps de
        l'application, pas seulement les tiens).
      </p>

      <input
        placeholder="Rechercher un exercice..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-surface2 border border-border rounded-md px-3 py-2 mb-4"
      />

      {exercises === null && <p className="text-muted">Chargement...</p>}

      <div className="space-y-2">
        {filtered.map((exo) => (
          <div
            key={exo.id}
            className="bg-surface border border-border rounded-lg p-4 flex items-center justify-between gap-3"
          >
            <div>
              <p className="font-medium">
                {exo.name}
                {exo.isCustom && (
                  <span className="ml-2 text-[10px] uppercase tracking-wide text-muted border border-border rounded px-1.5 py-0.5">
                    maison
                  </span>
                )}
              </p>
              {exo.description && <p className="text-xs text-muted mt-0.5">{exo.description}</p>}
            </div>
            <div className="text-right shrink-0">
              <p className="font-display text-lg text-accent">{exo.campCount}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted">
                camp{exo.campCount > 1 ? "s" : ""}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
