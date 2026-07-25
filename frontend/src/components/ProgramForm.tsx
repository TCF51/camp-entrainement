import { useState } from "react";
import { api, ApiError } from "../api/client";
import DurationInput from "./DurationInput";

// "Program" designe ici la consigne d'un exercice au sein d'un camp (CampExercise cote API).
// Seul le createur du camp (la "casquette entraineur") peut la modifier ; les autres membres
// ne font que la consulter (voir CampDetail.tsx).
export interface Program {
  id: string;
  exerciseId: string;
  description: string | null;
  targetSets: number;
  targetMode: "FIXED" | "MAX";
  targetValue: number | null;
  recurrenceType: "DAILY" | "WEEKLY" | "EVERY_N_DAYS";
  daysOfWeek: string | null;
  intervalDays: number | null;
}

interface Props {
  campId: string;
  exerciseId: string;
  exerciseName: string;
  unit: "REPS" | "SECONDS";
  existing?: Program;
  onSaved: () => void;
  onCancel: () => void;
}

const WEEKDAYS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Jeu" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sam" },
  { value: 0, label: "Dim" },
];

export default function ProgramForm({ campId, exerciseId, exerciseName, unit, existing, onSaved, onCancel }: Props) {
  const [description, setDescription] = useState(existing?.description ?? "");
  const [targetSets, setTargetSets] = useState(existing?.targetSets ?? 3);
  const [targetMode, setTargetMode] = useState<"FIXED" | "MAX">(existing?.targetMode ?? "FIXED");
  const [targetValue, setTargetValue] = useState(existing?.targetValue ?? (unit === "REPS" ? 10 : 30));
  const [recurrenceType, setRecurrenceType] = useState<"DAILY" | "WEEKLY" | "EVERY_N_DAYS">(
    existing?.recurrenceType ?? "DAILY"
  );
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(
    existing?.daysOfWeek ? JSON.parse(existing.daysOfWeek) : [1, 3, 5]
  );
  const [intervalDays, setIntervalDays] = useState(existing?.intervalDays ?? 2);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function toggleDay(day: number) {
    setDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  async function save() {
    setError(null);
    if (recurrenceType === "WEEKLY" && daysOfWeek.length === 0) {
      setError("Choisis au moins un jour de la semaine.");
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        campId,
        exerciseId,
        description: description.trim() || null,
        targetSets,
        targetMode,
        recurrenceType,
      };
      if (targetMode === "FIXED") payload.targetValue = targetValue;
      if (recurrenceType === "WEEKLY") payload.daysOfWeek = daysOfWeek;
      if (recurrenceType === "EVERY_N_DAYS") payload.intervalDays = intervalDays;

      await api.put("/camp-exercises", payload);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'enregistrer cette consigne.");
    } finally {
      setBusy(false);
    }
  }

  const unitLabel = unit === "REPS" ? "repetitions" : "duree";

  return (
    <div className="bg-surface2 border border-border rounded-lg p-4 space-y-4">
      <h3 className="font-display uppercase tracking-wide text-sm">{exerciseName}</h3>

      <div>
        <label className="block text-xs text-muted mb-1">Consigne (visible par tous les membres)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ex : Dos bien droit, descendre lentement..."
          rows={2}
          className="w-full bg-surface border border-border rounded-md px-2 py-1.5 text-sm resize-none"
        />
      </div>

      <div>
        <label className="block text-xs text-muted mb-1">Type d'objectif</label>
        <div className="flex gap-1.5 mb-3">
          <button
            type="button"
            onClick={() => setTargetMode("FIXED")}
            className={`px-3 py-1.5 rounded text-xs border ${
              targetMode === "FIXED" ? "bg-accent/20 border-accent text-text" : "bg-surface border-border text-muted"
            }`}
          >
            Objectif chiffre
          </button>
          <button
            type="button"
            onClick={() => setTargetMode("MAX")}
            className={`px-3 py-1.5 rounded text-xs border ${
              targetMode === "MAX" ? "bg-accent/20 border-accent text-text" : "bg-surface border-border text-muted"
            }`}
          >
            A fond (record perso)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted mb-1">Nombre de series</label>
          <input
            type="number"
            min={1}
            value={targetSets}
            onChange={(e) => setTargetSets(Number(e.target.value))}
            className="w-full bg-surface border border-border rounded-md px-2 py-1.5 text-sm"
          />
        </div>
        {targetMode === "FIXED" ? (
          <div>
            <label className="block text-xs text-muted mb-1">{unitLabel} par serie</label>
            {unit === "SECONDS" ? (
              <DurationInput totalSeconds={targetValue} onChange={setTargetValue} />
            ) : (
              <input
                type="number"
                min={1}
                value={targetValue}
                onChange={(e) => setTargetValue(Number(e.target.value))}
                className="w-full bg-surface border border-border rounded-md px-2 py-1.5 text-sm"
              />
            )}
          </div>
        ) : (
          <div>
            <label className="block text-xs text-muted mb-1">{unitLabel} par serie</label>
            <div className="w-full bg-surface border border-dashed border-border rounded-md px-2 py-1.5 text-sm text-muted">
              A fond, sans limite fixee
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs text-muted mb-1">Frequence</label>
        <select
          value={recurrenceType}
          onChange={(e) => setRecurrenceType(e.target.value as any)}
          className="w-full bg-surface border border-border rounded-md px-2 py-1.5 text-sm mb-2"
        >
          <option value="DAILY">Tous les jours</option>
          <option value="WEEKLY">Certains jours de la semaine</option>
          <option value="EVERY_N_DAYS">Tous les X jours</option>
        </select>

        {recurrenceType === "WEEKLY" && (
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d) => (
              <button
                type="button"
                key={d.value}
                onClick={() => toggleDay(d.value)}
                className={`px-2.5 py-1 rounded text-xs border ${
                  daysOfWeek.includes(d.value)
                    ? "bg-accent/20 border-accent text-text"
                    : "bg-surface border-border text-muted"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        )}

        {recurrenceType === "EVERY_N_DAYS" && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">Tous les</span>
            <input
              type="number"
              min={1}
              value={intervalDays}
              onChange={(e) => setIntervalDays(Number(e.target.value))}
              className="w-16 bg-surface border border-border rounded-md px-2 py-1"
            />
            <span className="text-muted">jours</span>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-accent">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={busy}
          className="bg-accent hover:bg-accentSoft transition-colors text-bg font-semibold rounded-md px-4 py-1.5 text-sm disabled:opacity-60"
        >
          {busy ? "Enregistrement..." : "Enregistrer"}
        </button>
        <button onClick={onCancel} className="text-muted hover:text-text text-sm px-2">
          Annuler
        </button>
      </div>
    </div>
  );
}
