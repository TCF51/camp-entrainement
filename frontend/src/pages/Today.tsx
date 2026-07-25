import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

interface TodayItem {
  programId: string;
  campId: string;
  campName: string;
  exerciseId: string;
  exerciseName: string;
  unit: "REPS" | "SECONDS";
  targetSets: number;
  targetValue: number;
  done: boolean;
  log: { setsDone: number; valueDone: number } | null;
}

export default function Today() {
  const [items, setItems] = useState<TodayItem[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sets, setSets] = useState(0);
  const [value, setValue] = useState(0);

  function load() {
    api.get<{ date: string; items: TodayItem[] }>("/today").then((res) => setItems(res.items));
  }
  useEffect(load, []);

  function startEditing(item: TodayItem) {
    setEditingId(item.programId);
    setSets(item.log?.setsDone ?? item.targetSets);
    setValue(item.log?.valueDone ?? item.targetValue);
  }

  async function confirm(item: TodayItem) {
    await api.post("/logs", { campId: item.campId, exerciseId: item.exerciseId, setsDone: sets, valueDone: value });
    setEditingId(null);
    load();
  }

  async function undo(item: TodayItem) {
    await api.del(`/logs?campId=${item.campId}&exerciseId=${item.exerciseId}`);
    load();
  }

  const doneCount = items?.filter((i) => i.done).length ?? 0;
  const total = items?.length ?? 0;

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-3xl uppercase tracking-wide mb-1">Aujourd'hui</h1>
      <p className="text-muted text-sm mb-6">
        {total === 0
          ? "Rien de prevu aujourd'hui."
          : `${doneCount} / ${total} seance${total > 1 ? "s" : ""} validee${doneCount > 1 ? "s" : ""}.`}
      </p>

      {items === null && <p className="text-muted">Chargement...</p>}

      {items?.length === 0 && (
        <div className="bg-surface border border-dashed border-border rounded-xl p-8 text-center">
          <p className="text-muted text-sm mb-3">
            Aucun exercice programme pour aujourd'hui. Va configurer ton programme dans un de tes camps.
          </p>
          <Link to="/camps" className="text-accent hover:text-accentSoft text-sm">
            Voir mes camps
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {items?.map((item) => {
          const unitLabel = item.unit === "REPS" ? "reps" : "sec";
          const isEditing = editingId === item.programId;

          return (
            <div
              key={item.programId}
              className={`bg-surface border rounded-xl p-4 transition-colors ${
                item.done ? "border-success/50" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-medium">{item.exerciseName}</p>
                  <p className="text-xs text-muted">
                    {item.campName} · objectif {item.targetSets} x {item.targetValue} {unitLabel}
                  </p>
                </div>

                {!isEditing && (
                  <button
                    onClick={() => (item.done ? undo(item) : startEditing(item))}
                    className={`stamp-btn w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold border-2 ${
                      item.done
                        ? "bg-success/20 border-success text-success"
                        : "bg-surface2 border-border text-muted hover:border-accent hover:text-accent"
                    }`}
                    aria-label={item.done ? "Annuler la validation" : "Valider la seance"}
                    title={item.done ? "Fait - clique pour annuler" : "Marquer comme fait"}
                  >
                    {item.done ? "✓" : ""}
                  </button>
                )}
              </div>

              {item.done && item.log && (
                <p className="text-xs text-muted mt-2">
                  Realise : {item.log.setsDone} x {item.log.valueDone} {unitLabel}
                </p>
              )}

              {isEditing && (
                <div className="mt-3 flex items-end gap-3 flex-wrap bg-surface2 border border-border rounded-md p-3">
                  <div>
                    <label className="block text-xs text-muted mb-1">Series faites</label>
                    <input
                      type="number"
                      min={0}
                      value={sets}
                      onChange={(e) => setSets(Number(e.target.value))}
                      className="w-20 bg-surface border border-border rounded-md px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1">{unitLabel} par serie</label>
                    <input
                      type="number"
                      min={0}
                      value={value}
                      onChange={(e) => setValue(Number(e.target.value))}
                      className="w-20 bg-surface border border-border rounded-md px-2 py-1"
                    />
                  </div>
                  <button
                    onClick={() => confirm(item)}
                    className="bg-accent text-bg font-semibold rounded-md px-4 py-1.5 text-sm"
                  >
                    Valider
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-muted text-sm px-2">
                    Annuler
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
