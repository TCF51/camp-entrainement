import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";

export interface Exercise {
  id: string;
  name: string;
  description: string | null;
  unit: "REPS" | "SECONDS";
  isCustom: boolean;
}

interface Props {
  selected: string[];
  onChange: (ids: string[]) => void;
}

export default function ExercisePicker({ selected, onChange }: Props) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState("");
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customUnit, setCustomUnit] = useState<"REPS" | "SECONDS">("REPS");

  function load() {
    api.get<Exercise[]>("/exercises").then(setExercises);
  }
  useEffect(load, []);

  const filtered = useMemo(
    () => exercises.filter((e) => e.name.toLowerCase().includes(search.toLowerCase())),
    [exercises, search]
  );

  function toggle(id: string) {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  }

  async function addCustom() {
    if (!customName.trim()) return;
    const created = await api.post<Exercise>("/exercises", { name: customName.trim(), unit: customUnit });
    setExercises((prev) => [...prev, created]);
    onChange([...selected, created.id]);
    setCustomName("");
    setShowCustomForm(false);
  }

  return (
    <div>
      <input
        placeholder="Rechercher un exercice..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-surface2 border border-border rounded-md px-3 py-2 mb-3"
      />

      <div className="grid sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1 mb-3">
        {filtered.map((exo) => {
          const isSelected = selected.includes(exo.id);
          return (
            <button
              type="button"
              key={exo.id}
              onClick={() => toggle(exo.id)}
              className={`text-left border rounded-md px-3 py-2 transition-colors ${
                isSelected ? "bg-accent/15 border-accent text-text" : "bg-surface2 border-border text-muted hover:text-text"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{exo.name}</span>
                <span className="text-[10px] font-mono uppercase text-muted">
                  {exo.unit === "REPS" ? "reps" : "sec"}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {!showCustomForm ? (
        <button
          type="button"
          onClick={() => setShowCustomForm(true)}
          className="text-sm text-accent hover:text-accentSoft"
        >
          + Ajouter un exercice qui n'est pas dans la liste
        </button>
      ) : (
        <div className="bg-surface2 border border-border rounded-md p-3 flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs text-muted mb-1">Nom de l'exercice</label>
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="w-full bg-surface border border-border rounded-md px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Unite</label>
            <select
              value={customUnit}
              onChange={(e) => setCustomUnit(e.target.value as "REPS" | "SECONDS")}
              className="bg-surface border border-border rounded-md px-2 py-1.5 text-sm"
            >
              <option value="REPS">Repetitions</option>
              <option value="SECONDS">Secondes (duree tenue)</option>
            </select>
          </div>
          <button
            type="button"
            onClick={addCustom}
            className="bg-accent text-bg font-semibold rounded-md px-3 py-1.5 text-sm"
          >
            Ajouter
          </button>
        </div>
      )}
    </div>
  );
}
