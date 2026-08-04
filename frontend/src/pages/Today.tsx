import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import DurationInput from "../components/DurationInput";
import CircuitRunner from "../components/CircuitRunner";
import ExerciseMediaModal from "../components/ExerciseMediaModal";
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
  imageBase64: string | null;
  videoUrl: string | null;
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

function targetLabelFor(item: TodayExerciseItem): string {
  const unitLabel = item.unit === "REPS" ? "reps" : "sec";
  return item.targetMode === "MAX"
    ? `${item.targetSets} serie${item.targetSets > 1 ? "s" : ""} à fond${
        item.personalBest
          ? ` (record : ${item.unit === "SECONDS" ? secondsToMMSS(item.personalBest) : item.personalBest} ${unitLabel})`
          : ""
      }`
    : `${item.targetSets} x ${
        item.unit === "SECONDS" && item.targetValue ? secondsToMMSS(item.targetValue) : item.targetValue
      } ${item.unit === "SECONDS" ? "" : unitLabel}`;
}

export default function Today() {
  const { user } = useAuth();
  const [items, setItems] = useState<TodayExerciseItem[] | null>(null);
  const [circuits, setCircuits] = useState<TodayCircuitItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null); // campExerciseId (simple) ou exerciseId (groupe)
  const [selectedCampIds, setSelectedCampIds] = useState<string[]>([]);
  const [sets, setSets] = useState(0);
  const [value, setValue] = useState(0);
  const [celebrating, setCelebrating] = useState<NewBadge[]>([]);
  const [isRestToday, setIsRestToday] = useState(false);
  const [restBusy, setRestBusy] = useState(false);
  const [viewingMedia, setViewingMedia] = useState<TodayExerciseItem | null>(null);
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

  useEffect(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    api.get<{ date: string }[]>("/rest-days").then((days) => {
      setIsRestToday(days.some((d) => d.date.slice(0, 10) === todayKey));
    });
  }, []);

  async function toggleRestDay() {
    setRestBusy(true);
    try {
      if (isRestToday) {
        await api.del("/rest-days");
        setIsRestToday(false);
      } else {
        await api.post("/rest-days", {});
        setIsRestToday(true);
      }
    } finally {
      setRestBusy(false);
    }
  }

  // Regroupe les exercices identiques (meme exerciseId) presents dans plusieurs camps,
  // pour proposer une validation combinee plutot que deux cartes separees.
  const groups = useMemo(() => {
    const map = new Map<string, TodayExerciseItem[]>();
    items?.forEach((item) => {
      const arr = map.get(item.exerciseId) ?? [];
      arr.push(item);
      map.set(item.exerciseId, arr);
    });
    return [...map.values()];
  }, [items]);

  function startEditingSingle(item: TodayExerciseItem) {
    setEditingId(item.campExerciseId);
    setSelectedCampIds([item.campId]);
    setSets(item.log?.setsDone ?? item.targetSets);
    setValue(item.log?.valueDone ?? item.targetValue ?? item.personalBest ?? 0);
  }

  function startEditingGroup(group: TodayExerciseItem[]) {
    const notDone = group.filter((i) => !i.done);
    setEditingId(group[0].exerciseId);
    setSelectedCampIds(notDone.map((i) => i.campId));
    const ref = notDone[0] ?? group[0];
    setSets(ref.targetSets);
    setValue(ref.targetValue ?? ref.personalBest ?? 0);
  }

  async function confirmCampIds(exerciseId: string, campIds: string[]) {
    if (campIds.length === 0) {
      setEditingId(null);
      return;
    }
    const res = await api.post<{ newBadges: NewBadge[] }>("/logs", {
      campIds,
      exerciseId,
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
      {viewingMedia && (
        <ExerciseMediaModal
          name={viewingMedia.exerciseName}
          imageBase64={viewingMedia.imageBase64}
          videoUrl={viewingMedia.videoUrl}
          onClose={() => setViewingMedia(null)}
        />
      )}

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

      <h1 className="font-display text-3xl uppercase tracking-wide mb-1">Salut {user?.name?.split(" ")[0] ?? ""} 👋</h1>
      <p className="text-muted text-sm mb-3">
        {total === 0
          ? "Rien de prevu aujourd'hui."
          : `${doneCount} / ${total} séance${total > 1 ? "s" : ""} validee${doneCount > 1 ? "s" : ""}.`}
      </p>

      {isRestToday ? (
        <div className="bg-success/10 border border-success rounded-xl p-3 mb-5 flex items-center justify-between gap-3">
          <p className="text-sm">😴 Jour de repos justifie — ta serie de régularité n'est pas cassee aujourd'hui.</p>
          <button
            onClick={toggleRestDay}
            disabled={restBusy}
            className="text-xs text-muted hover:text-accent shrink-0"
          >
            Annuler
          </button>
        </div>
      ) : (
        <button
          onClick={toggleRestDay}
          disabled={restBusy}
          className="text-xs text-muted hover:text-accent mb-5 underline decoration-dotted"
        >
          😴 Marquer aujourd'hui comme jour de repos (blessure, voyage...)
        </button>
      )}

      {items === null && <p className="text-muted">Chargement...</p>}

      {items?.length === 0 && circuits.length === 0 && (
        <div className="bg-surface border border-dashed border-border rounded-xl p-8 text-center">
          <p className="text-muted text-sm mb-3">
            Rien de prevu aujourd'hui — profite de ta journee, ou va voir tes camps pour en rejoindre ou en créer un
            si l'envie de bouger te prend !
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
        {groups.map((group) => {
          const first = group[0];
          const isGrouped = group.length > 1;
          const unitLabel = first.unit === "REPS" ? "reps" : "sec";
          const hasMedia = !!(first.imageBase64 || first.videoUrl);
          const allDone = group.every((i) => i.done);
          const isEditing = editingId === (isGrouped ? first.exerciseId : first.campExerciseId);
          const canQuickChrono = !isGrouped && first.unit === "SECONDS" && first.targetMode === "FIXED" && !first.done;

          return (
            <div
              key={first.exerciseId}
              className={`bg-surface border rounded-xl p-4 transition-colors ${
                allDone ? "border-success/50" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <button
                    onClick={() => hasMedia && setViewingMedia(first)}
                    className={`font-medium text-left ${hasMedia ? "underline decoration-dotted hover:text-accent" : ""}`}
                    title={hasMedia ? "Voir la photo/video de l'exercice" : undefined}
                  >
                    {first.exerciseName} {hasMedia && "📷"}
                  </button>
                  {!isGrouped ? (
                    <p className="text-xs text-muted">
                      {first.campName} · objectif {targetLabelFor(first)}
                    </p>
                  ) : (
                    <div className="text-xs text-muted space-y-0.5">
                      {group.map((i) => (
                        <p key={i.campId}>
                          {i.done ? "✓ " : ""}
                          {i.campName} · {targetLabelFor(i)}
                        </p>
                      ))}
                    </div>
                  )}
                  {first.description && <p className="text-xs text-muted italic mt-0.5">"{first.description}"</p>}
                </div>

                {!isEditing && (
                  <div className="flex items-center gap-2 shrink-0">
                    {canQuickChrono && (
                      <button
                        onClick={() => setRunner({ type: "exercise", item: first })}
                        title="Lancer le chrono pour cet exercice"
                        className="w-10 h-10 rounded-full flex items-center justify-center border-2 border-accent text-accent hover:bg-accent/10"
                      >
                        ⏱
                      </button>
                    )}
                    {allDone ? (
                      <button
                        onClick={() => undo(first)}
                        className="stamp-btn pop-success w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold border-2 bg-success/20 border-success text-success"
                        title="Fait - clique pour annuler"
                      >
                        ✓
                      </button>
                    ) : (
                      <button
                        onClick={() => (isGrouped ? startEditingGroup(group) : startEditingSingle(first))}
                        className="stamp-btn w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold border-2 bg-surface2 border-border text-muted hover:border-accent hover:text-accent"
                        title="Marquer comme fait"
                      />
                    )}
                  </div>
                )}
              </div>

              {!isGrouped && first.done && first.log && (
                <p className="text-xs text-muted mt-2">
                  Réalisé : {first.log.setsDone} x{" "}
                  {first.unit === "SECONDS" ? secondsToMMSS(first.log.valueDone) : `${first.log.valueDone} ${unitLabel}`}
                </p>
              )}

              {isEditing && (
                <div className="mt-3 bg-surface2 border border-border rounded-md p-3 space-y-3">
                  {isGrouped && (
                    <div>
                      <p className="text-xs text-muted mb-1">Valider pour :</p>
                      <div className="flex flex-wrap gap-2">
                        {group
                          .filter((i) => !i.done)
                          .map((i) => (
                            <label key={i.campId} className="flex items-center gap-1.5 text-sm">
                              <input
                                type="checkbox"
                                checked={selectedCampIds.includes(i.campId)}
                                onChange={(e) =>
                                  setSelectedCampIds((prev) =>
                                    e.target.checked ? [...prev, i.campId] : prev.filter((c) => c !== i.campId)
                                  )
                                }
                              />
                              {i.campName}
                            </label>
                          ))}
                      </div>
                    </div>
                  )}
                  <div className="flex items-end gap-3 flex-wrap">
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
                      {first.unit === "SECONDS" ? (
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
                      onClick={() => confirmCampIds(first.exerciseId, selectedCampIds)}
                      className="bg-accent text-bg font-semibold rounded-md px-4 py-1.5 text-sm"
                    >
                      Valider
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-muted text-sm px-2">
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
