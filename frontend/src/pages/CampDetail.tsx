import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import ProgramForm, { Program } from "../components/ProgramForm";
import CampCircuitForm, { CampCircuitData } from "../components/CampCircuitForm";
import CircuitRunner from "../components/CircuitRunner";
import ReactionPicker, { ReactionSummary } from "../components/ReactionPicker";
import { secondsToMMSS } from "../lib/duration";

interface FeedItem {
  targetType: "exercise" | "circuit";
  targetId: string;
  userId: string;
  userName: string;
  label: string;
  date: string;
  setsDone: number | null;
  valueDone: number | null;
  unit: "REPS" | "SECONDS" | null;
  durationSeconds: number | null;
  reactions: ReactionSummary[];
}

interface CampExerciseData extends Program {
  exercise: { id: string; name: string; unit: "REPS" | "SECONDS"; description: string | null };
}

interface CampDetailData {
  id: string;
  name: string;
  description: string | null;
  code: string;
  createdById: string;
  startDate: string | null;
  endDate: string | null;
  isEnded: boolean;
  myRole: "COACH" | "PLAYER";
  exercises: CampExerciseData[];
  circuits: CampCircuitData[];
  members: { user: { id: string; name: string } }[];
}

interface CatalogExercise {
  id: string;
  name: string;
}

const RECURRENCE_LABEL: Record<
  string,
  (p: { recurrenceType: string; daysOfWeek: string | null; intervalDays: number | null; timesPerWeek?: number | null }) => string
> = {
  DAILY: () => "Tous les jours",
  WEEKLY: (p) => {
    const days = p.daysOfWeek ? (JSON.parse(p.daysOfWeek) as number[]) : [];
    const names = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    return days.map((d) => names[d]).join(", ");
  },
  EVERY_N_DAYS: (p) => `Tous les ${p.intervalDays} jours`,
  WEEKLY_COUNT: (p) => `${p.timesPerWeek}x/semaine (jours libres)`,
};

const QUICK_CHRONO_REST_SECONDS = 15;

export default function CampDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [camp, setCamp] = useState<CampDetailData | null>(null);
  const [catalog, setCatalog] = useState<CatalogExercise[]>([]);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [savingDescription, setSavingDescription] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingCircuitId, setEditingCircuitId] = useState<string | null>(null);
  const [creatingCircuit, setCreatingCircuit] = useState(false);
  const [runningCircuit, setRunningCircuit] = useState<CampCircuitData | null>(null);
  const [runningExercise, setRunningExercise] = useState<CampExerciseData | null>(null);
  const [feed, setFeed] = useState<FeedItem[] | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  async function copyCode() {
    if (!camp) return;
    await navigator.clipboard.writeText(camp.code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  function loadFeed() {
    if (!id) return;
    api.get<FeedItem[]>(`/camps/${id}/feed`).then(setFeed);
  }

  async function duplicateCamp() {
    if (!camp) return;
    setDuplicating(true);
    try {
      const created = await api.post<{ id: string }>(`/camps/${camp.id}/duplicate`, {});
      navigate(`/camps/${created.id}`);
    } finally {
      setDuplicating(false);
    }
  }

  function load() {
    if (!id) return;
    api.get<CampDetailData>(`/camps/${id}`).then(setCamp);
  }
  useEffect(load, [id]);
  useEffect(loadFeed, [id]);
  useEffect(() => {
    api.get<CatalogExercise[]>("/exercises").then(setCatalog);
  }, []);

  async function deleteCamp() {
    if (!camp) return;
    setDeleting(true);
    try {
      await api.del(`/camps/${camp.id}`);
      navigate("/camps");
    } finally {
      setDeleting(false);
    }
  }

  async function saveDescription() {
    if (!camp) return;
    setSavingDescription(true);
    try {
      await api.put(`/camps/${camp.id}`, { description: descriptionDraft.trim() || null });
      setEditingDescription(false);
      load();
    } finally {
      setSavingDescription(false);
    }
  }

  async function deleteCircuit(circuitId: string) {
    await api.del(`/camp-circuits/${circuitId}`);
    load();
  }

  async function onExerciseChronoComplete(ce: CampExerciseData) {
    await api.post("/logs", { campId: id, exerciseId: ce.exercise.id, setsDone: ce.targetSets, valueDone: ce.targetValue ?? 0 });
    setRunningExercise(null);
    load();
  }

  async function onCircuitChronoComplete(circuit: CampCircuitData, totalDurationSeconds: number) {
    await api.post(`/camp-circuits/${circuit.id}/log`, { durationSeconds: totalDurationSeconds });
    setRunningCircuit(null);
    load();
  }

  if (!camp) return <p className="text-muted">Chargement...</p>;

  const isCoach = user?.id === camp.createdById;

  if (runningExercise) {
    return (
      <div className="max-w-md mx-auto">
        <CircuitRunner
          items={[{ name: runningExercise.exercise.name }]}
          workSeconds={runningExercise.targetValue ?? 30}
          restSeconds={0}
          rounds={runningExercise.targetSets}
          roundRestSeconds={QUICK_CHRONO_REST_SECONDS}
          onComplete={() => onExerciseChronoComplete(runningExercise)}
          onCancel={() => setRunningExercise(null)}
        />
      </div>
    );
  }

  if (runningCircuit) {
    const circuitItems = JSON.parse(runningCircuit.items) as { name: string }[];
    return (
      <div className="max-w-md mx-auto">
        <CircuitRunner
          items={circuitItems}
          workSeconds={runningCircuit.workSeconds}
          restSeconds={runningCircuit.restSeconds}
          rounds={runningCircuit.rounds}
          roundRestSeconds={runningCircuit.roundRestSeconds}
          onComplete={(duration) => onCircuitChronoComplete(runningCircuit, duration)}
          onCancel={() => setRunningCircuit(null)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display text-3xl uppercase tracking-wide">{camp.name}</h1>
            {camp.isEnded && (
              <span className="text-[10px] uppercase tracking-wide bg-surface2 border border-border rounded px-2 py-0.5 text-muted">
                Termine
              </span>
            )}
            <span className="text-[10px] uppercase tracking-wide bg-accent/15 text-accent rounded px-2 py-0.5">
              {camp.myRole === "COACH" ? "Entraineur" : "Coequipier"}
            </span>
          </div>
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
          <p className="font-mono text-lg text-accent mb-1">{camp.code}</p>
          <button onClick={copyCode} className="text-[10px] text-muted hover:text-accent">
            {codeCopied ? "Copie !" : "📋 Copier"}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap mt-2">
        <Link to={`/camps/${camp.id}/discussion`} className="text-sm text-accent hover:text-accentSoft">
          💬 Discussion du camp
        </Link>
        <Link to={`/camps/${camp.id}/classement`} className="text-sm text-accent hover:text-accentSoft">
          📊 Classement (régularité)
        </Link>
        <Link to={`/camps/${camp.id}/calendrier`} className="text-sm text-accent hover:text-accentSoft">
          🗓️ Calendrier
        </Link>
        {isCoach && (
          <>
            <button onClick={duplicateCamp} disabled={duplicating} className="text-sm text-muted hover:text-accent">
              {duplicating ? "Duplication..." : "Dupliquer le camp"}
            </button>
            <button onClick={() => setConfirmingDelete(true)} className="text-sm text-muted hover:text-accent ml-auto">
              Supprimer le camp
            </button>
          </>
        )}
      </div>

      {confirmingDelete && (
        <div className="bg-surface border border-accent rounded-lg p-4 mt-3">
          <p className="text-sm mb-3">
            Supprimer definitivement le camp "{camp.name}" ? Cette action est irreversible : l'historique des
            séances de tous les membres pour ce camp sera perdu.
          </p>
          <div className="flex gap-2">
            <button
              onClick={deleteCamp}
              disabled={deleting}
              className="bg-accent hover:bg-accentSoft transition-colors text-bg font-semibold rounded-md px-3 py-1.5 text-sm disabled:opacity-60"
            >
              {deleting ? "Suppression..." : "Oui, supprimer"}
            </button>
            <button onClick={() => setConfirmingDelete(false)} className="text-muted hover:text-text text-sm px-2">
              Annuler
            </button>
          </div>
        </div>
      )}

      <div className="mt-4">
        {editingDescription ? (
          <div className="bg-surface2 border border-border rounded-lg p-3">
            <textarea
              value={descriptionDraft}
              onChange={(e) => setDescriptionDraft(e.target.value)}
              placeholder="Descriptif du camp..."
              rows={3}
              className="w-full bg-surface border border-border rounded-md px-2 py-1.5 text-sm resize-none mb-2"
            />
            <div className="flex gap-2">
              <button
                onClick={saveDescription}
                disabled={savingDescription}
                className="bg-accent hover:bg-accentSoft transition-colors text-bg font-semibold rounded-md px-3 py-1.5 text-sm disabled:opacity-60"
              >
                {savingDescription ? "Enregistrement..." : "Enregistrer"}
              </button>
              <button onClick={() => setEditingDescription(false)} className="text-muted hover:text-text text-sm px-2">
                Annuler
              </button>
            </div>
          </div>
        ) : camp.description ? (
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-muted italic">{camp.description}</p>
            {isCoach && (
              <button
                onClick={() => {
                  setDescriptionDraft(camp.description ?? "");
                  setEditingDescription(true);
                }}
                className="text-xs text-accent hover:text-accentSoft shrink-0"
              >
                Modifier
              </button>
            )}
          </div>
        ) : (
          isCoach && (
            <button
              onClick={() => {
                setDescriptionDraft("");
                setEditingDescription(true);
              }}
              className="text-xs text-accent hover:text-accentSoft"
            >
              + Ajouter un descriptif au camp
            </button>
          )
        )}
      </div>

      <h2 className="font-display uppercase tracking-wide text-lg mt-8 mb-1">Exercices du camp</h2>
      <p className="text-muted text-sm mb-4">
        {isCoach
          ? "En tant que créateur du camp, tu définis la consigne (objectif, fréquence) suivie par tous les membres."
          : "Consignes définies par le créateur du camp."}
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
          const canQuickChrono = ce.exercise.unit === "SECONDS" && ce.targetMode === "FIXED";

          return (
            <div key={ce.exercise.id} className="bg-surface border border-border rounded-lg p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="font-medium">{ce.exercise.name}</p>
                  <p className="text-sm text-muted">
                    {ce.targetMode === "MAX"
                      ? `${ce.targetSets} serie${ce.targetSets > 1 ? "s" : ""} à fond`
                      : `${ce.targetSets} x ${valueLabel}`}{" "}
                    · {RECURRENCE_LABEL[ce.recurrenceType](ce)}
                  </p>
                  {ce.description && <p className="text-xs text-muted mt-1 italic">"{ce.description}"</p>}
                </div>
                <div className="flex gap-3 items-center shrink-0">
                  {canQuickChrono && (
                    <button
                      onClick={() => setRunningExercise(ce)}
                      title="Lancer le chrono pour cet exercice"
                      className="w-9 h-9 rounded-full flex items-center justify-center border-2 border-accent text-accent hover:bg-accent/10"
                    >
                      ⏱
                    </button>
                  )}
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

      <div className="flex items-center justify-between mt-8 mb-1">
        <h2 className="font-display uppercase tracking-wide text-lg">Circuits training du camp</h2>
        {isCoach && !creatingCircuit && (
          <button onClick={() => setCreatingCircuit(true)} className="text-sm text-accent hover:text-accentSoft">
            + Nouveau circuit
          </button>
        )}
      </div>
      <p className="text-muted text-sm mb-4">
        Enchainements guides au chrono, alternative aux exercices individuels.
      </p>

      {creatingCircuit && (
        <div className="mb-3">
          <CampCircuitForm
            campId={camp.id}
            catalog={catalog}
            onSaved={() => {
              setCreatingCircuit(false);
              load();
            }}
            onCancel={() => setCreatingCircuit(false)}
          />
        </div>
      )}

      <div className="space-y-3">
        {camp.circuits.map((circuit) => {
          if (editingCircuitId === circuit.id) {
            return (
              <CampCircuitForm
                key={circuit.id}
                campId={camp.id}
                catalog={catalog}
                existing={circuit}
                onSaved={() => {
                  setEditingCircuitId(null);
                  load();
                }}
                onCancel={() => setEditingCircuitId(null)}
              />
            );
          }
          const circuitItems = JSON.parse(circuit.items) as { name: string }[];
          return (
            <div key={circuit.id} className="bg-surface border border-border rounded-lg p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="font-medium">🔁 {circuit.name}</p>
                  <p className="text-sm text-muted">
                    {circuitItems.map((i) => i.name).join(", ")} · {circuit.rounds} tour{circuit.rounds > 1 ? "s" : ""} ·{" "}
                    {RECURRENCE_LABEL[circuit.recurrenceType](circuit)}
                  </p>
                  {circuit.description && <p className="text-xs text-muted mt-1 italic">"{circuit.description}"</p>}
                </div>
                <div className="flex gap-2 items-center shrink-0">
                  <button
                    onClick={() => setRunningCircuit(circuit)}
                    className="bg-accent hover:bg-accentSoft transition-colors text-bg font-semibold rounded-md px-3 py-1.5 text-sm"
                  >
                    ⏱ Lancer
                  </button>
                  {isCoach && (
                    <>
                      <button
                        onClick={() => setEditingCircuitId(circuit.id)}
                        className="text-sm bg-surface2 hover:bg-border transition-colors border border-border rounded-md px-3 py-1.5"
                      >
                        Modifier
                      </button>
                      <button onClick={() => deleteCircuit(circuit.id)} className="text-muted hover:text-accent text-sm">
                        Suppr.
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {camp.circuits.length === 0 && !creatingCircuit && (
          <p className="text-muted text-sm italic">Aucun circuit pour l'instant.</p>
        )}
      </div>

      <h2 className="font-display uppercase tracking-wide text-lg mt-8 mb-1">Fil d'activité</h2>
      <p className="text-muted text-sm mb-4">
        Les dernières séances validees par les membres du camp — pour s'encourager, pas pour comparer.
      </p>
      <div className="space-y-2">
        {feed === null && <p className="text-muted text-sm">Chargement...</p>}
        {feed?.length === 0 && <p className="text-muted text-sm italic">Aucune activité pour l'instant.</p>}
        {feed?.map((item) => (
          <div key={`${item.targetType}-${item.targetId}`} className="bg-surface border border-border rounded-lg p-3">
            <p className="text-sm">
              <span className="font-medium">{item.userName}</span> a validé{" "}
              <span className="text-muted">{item.label}</span>
              {item.targetType === "exercise" && item.setsDone != null && item.valueDone != null && (
                <span className="text-muted">
                  {" "}
                  ({item.setsDone} x {item.unit === "SECONDS" ? secondsToMMSS(item.valueDone) : `${item.valueDone} reps`})
                </span>
              )}
              {item.targetType === "circuit" && item.durationSeconds != null && (
                <span className="text-muted"> ({secondsToMMSS(item.durationSeconds)})</span>
              )}
            </p>
            <div className="flex items-center justify-between mt-2">
              <p className="text-[10px] text-muted">
                {new Date(item.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
              </p>
              <ReactionPicker
                targetType={item.targetType}
                targetId={item.targetId}
                reactions={item.reactions}
                onChange={loadFeed}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
