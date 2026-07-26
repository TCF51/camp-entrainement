import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import DurationInput from "../components/DurationInput";
import CircuitRunner from "../components/CircuitRunner";
import { secondsToMMSS } from "../lib/duration";

interface TodayExerciseItem {
  kind: "exercise";
  campExerciseId: string;
  campId: string;
  campName: string;
  exerciseId: string;
  exerciseName: string;
  description: string | null;
  unit: "REPS" | "SECONDS";
  targetSets: number;
  targetMode: "FIXED" | "MAX";
  targetValue: number | null;
  personalBest: number | null;
  done: boolean;
  log: { setsDone: number; valueDone: number } | null;
}

interface TodayCircuitItem {
  kind: "circuit";
  campCircuitId: string;
  campId: string;
  campName: string;
  name: string;
  description: string | null;
  items: { exerciseId?: string; name: string }[];
  workSeconds: number;
  restSeconds: number;
  rounds: number;
  roundRestSeconds: number;
  done: boolean;
}

interface NewBadge {
  key: string;
  name: string;
  description: string;
  emoji: string;
}

// Repos par defaut entre chaque serie lors d'un chrono rapide lance sur un seul exercice
const QUICK_CHRONO_REST_SECONDS = 15;

export default function Today() {
  const [items, setItems] = useState<TodayExerciseItem[] | null>(null);
  const [circuits, setCircuits] = useState<TodayCircuitItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sets, setSets] = useState(0);
  const [value, setValue] = useState(0);
  const [celebrating, setCelebrating] = useState<NewBadge[]>([]);
  const [runner, setRunner] = useState<
    | { type: "exercise"; item: TodayExerciseItem }
    | { type: "circuit"; item: TodayCircuitItem }
    | null
  >(null);

  function load() {
    api
      .get<{ date: string; items: TodayExerciseItem[]; circuits: TodayCircuitItem[] }>("/today")
      .then((res) => {
        setItems(res.items);
        setCircuits(res.circuits);
      });
  }
  useEffect(load, []);

  function startEditing(item: TodayExerciseItem) {
    setEditingId(item.campExerciseId);
    setSets(item.log?.setsDone ?? item.targetSets);
    setValue(item.log?.valueDone ?? item.targetValue ?? item.personalBest ?? 0);
  }

  async function confirm(item: TodayExerciseItem) {
    const res = await api.post<{ newBadges: NewBadge[] }>("/logs", {
      campId: item.campId,
      exerciseId: item.exerciseId,
      setsDone: sets,
      valueDone: value,
    });
    setEditingId(null);
    load();
    if (res.newBadges?.length) setCelebrating(res.newBadges);
  }

  async function undo(item: TodayExerciseItem) {
    await api.del(`/logs?campId=${item.campId}&exerciseId=${item.exerciseId}`);
    load();
  }

  async function onExerciseChronoComplete(item: TodayExerciseItem) {
    const res = await api.post<{ newBadges: NewBadge[] }>("/logs", {
      campId: item.campId,
      exerciseId: item.exerciseId,
      setsDone: item.targetSets,
      valueDone: item.targetValue ?? 0,
    });
    setRunner(null);
    load();
    if (res.newBadges?.length) setCelebrating(res.newBadges);
  }

  async function onCircuitComplete(item: TodayCircuitItem, totalDurationSeconds: number) {
    const res = await api.post<{ newBadges: NewBadge[] }>(`/camp-circuits/${item.campCircuitId}/log`, {
      durationSeconds: totalDurationSeconds,
    });
    setRunner(null);
    load();
    if (res.newBadges?.length) setCelebrating(res.newBadges);
  }

  if (runner?.type === "exercise") {
    const item = runner.item;
    return (
      <div className="max-w-md mx-auto">
        <CircuitRunner
          items={[{ name: item.exerciseName }]}
          workSeconds={item.targetValue ?? 30}
          restSeconds={0}
          rounds={item.targetSets}
          roundRestSeconds={QUICK_CHRONO_REST_SECONDS}
          onComplete={() => onExerciseChronoComplete(item)}
          onCancel={() => setRunner(null)}
        />
      </div>
    );
  }

  if (runner?.type === "circuit") {
    const item = runner.item;
    return (
      <div className="max-w-md mx-auto">
        <CircuitRunner
          items={item.items.map((i) => ({ name: i.name }))}
          workSeconds={item.workSeconds}
          restSeconds={item.restSeconds}
          rounds={item.rounds}
          roundRestSeconds={item.roundRestSeconds}
          onComplete={(duration) => onCircuitComplete(item, duration)}
          onCancel={() => setRunner(null)}
        />
      </div>
    );
  }

  const doneCount = (items?.filter((i) => i.done).length ?? 0) + circuits.filter((c) => c.done).length;
  const total = (items?.length ?? 0) + circuits.length;

  return (
    <div className="max-w-xl">
      {celebrating.length > 0 && (
        <div className="bg-accent/10 border border-accent rounded-xl p-4 mb-5">
          {celebrating.map((b) => (
            <p key={b.key} className="text-sm">
              <span className="text-xl mr-2">{b.emoji}</span>
              Nouveau badge : <span className="font-semibold">{b.name}</span> — {b.description}
            </p>
          ))}
          <button onClick={() => setCelebrating([])} className="text-xs text-muted hover:text-text mt-2">
            Fermer
          </button>
        </div>
      )}

      <h1 className="font-display text-3xl uppercase tracking-wide mb-1">Aujourd'hui</h1>
      <p className="text-muted text-sm mb-6">
        {total === 0
          ? "Rien de prevu aujourd'hui."
          : `${doneCount} / ${total} seance${total > 1 ? "s" : ""} validee${doneCount > 1 ? "s" : ""}.`}
      </p>

      {items === null && <p className="text-muted">Chargement...</p>}

      {items?.length === 0 && circuits.length === 0 && (
        <div className="bg-surface border border-dashed border-border rounded-xl p-8 text-center">
          <p className="text-muted text-sm mb-3">
            Aucun exercice programme pour aujourd'hui. Va voir tes camps pour rejoindre ou creer un camp.
          </p>
          <Link to="/camps" className="text-accent hover:text-accentSoft text-sm">
            Voir mes camps
          </Link>
        </div>
      )}

      {circuits.length > 0 && (
        <div className="space-y-3 mb-4">
          {circuits.map((c) => (
            <div
              key={c.campCircuitId}
              className={`bg-surface border rounded-xl p-4 ${c.done ? "border-success/50" : "border-border"}`}
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-medium">🔁 {c.name}</p>
                  <p className="text-xs text-muted">
                    {c.campName} · {c.rounds} tour{c.rounds > 1 ? "s" : ""} · {c.items.length} exercice
                    {c.items.length > 1 ? "s" : ""}
                  </p>
                  {c.description && <p className="text-xs text-muted italic mt-0.5">"{c.description}"</p>}
                </div>
                {c.done ? (
                  <span className="text-success text-sm shrink-0">✓ Fait</span>
                ) : (
                  <button
                    onClick={() => setRunner({ type: "circuit", item: c })}
                    className="bg-accent hover:bg-accentSoft transition-colors text-bg font-semibold rounded-md px-4 py-2 text-sm shrink-0"
                  >
                    ⏱ Lancer
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {items?.map((item) => {
          const unitLabel = item.unit === "REPS" ? "reps" : "sec";
          const isEditing = editingId === item.campExerciseId;
          const canQuickChrono = item.unit === "SECONDS" && item.targetMode === "FIXED" && !item.done;
          const targetLabel =
            item.targetMode === "MAX"
              ? `${item.targetSets} serie${item.targetSets > 1 ? "s" : ""} a fond${
                  item.personalBest
                    ? ` (record : ${item.unit === "SECONDS" ? secondsToMMSS(item.personalBest) : item.personalBest} ${unitLabel})`
                    : ""
                }`
              : `${item.targetSets} x ${item.unit === "SECONDS" && item.targetValue ? secondsToMMSS(item.targetValue) : item.targetValue} ${item.unit === "SECONDS" ? "" : unitLabel}`;

          return (
            <div
              key={item.campExerciseId}
              className={`bg-surface border rounded-xl p-4 transition-colors ${
                item.done ? "border-success/50" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-medium">{item.exerciseName}</p>
                  <p className="text-xs text-muted">
                    {item.campName} · objectif {targetLabel}
                  </p>
                  {item.description && <p className="text-xs text-muted italic mt-0.5">"{item.description}"</p>}
                </div>

                {!isEditing && (
                  <div className="flex items-center gap-2 shrink-0">
                    {canQuickChrono && (
                      <button
                        onClick={() => setRunner({ type: "exercise", item })}
                        title="Lancer le chrono pour cet exercice"
                        className="w-10 h-10 rounded-full flex items-center justify-center border-2 border-accent text-accent hover:bg-accent/10"
                      >
                        ⏱
                      </button>
                    )}
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
                  </div>
                )}
              </div>

              {item.done && item.log && (
                <p className="text-xs text-muted mt-2">
                  Realise : {item.log.setsDone} x{" "}
                  {item.unit === "SECONDS" ? secondsToMMSS(item.log.valueDone) : `${item.log.valueDone} ${unitLabel}`}
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
                    {item.unit === "SECONDS" ? (
                      <DurationInput totalSeconds={value} onChange={setValue} />
                    ) : (
                      <input
                        type="number"
                        min={0}
                        value={value}
                        onChange={(e) => setValue(Number(e.target.value))}
                        className="w-20 bg-surface border border-border rounded-md px-2 py-1"
                      />
                    )}
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
