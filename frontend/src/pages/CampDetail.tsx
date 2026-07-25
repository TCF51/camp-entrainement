import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
  description: string | null;
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const [camp, setCamp] = useState<CampDetailData | null>(null);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [savingDescription, setSavingDescription] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function load() {
    if (!id) return;
    api.get<CampDetailData>(`/camps/${id}`).then(setCamp);
  }
  useEffect(load, [id]);

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

      <div className="flex items-center gap-4 flex-wrap mt-2">
        <Link to={`/camps/${camp.id}/discussion`} className="text-sm text-accent hover:text-accentSoft">
          💬 Discussion du camp
        </Link>
        <Link to={`/camps/${camp.id}/classement`} className="text-sm text-accent hover:text-accentSoft">
          📊 Classement (regularite)
        </Link>
        {isCoach && (
          <button
            onClick={() => setConfirmingDelete(true)}
            className="text-sm text-muted hover:text-accent ml-auto"
          >
            Supprimer le camp
          </button>
        )}
      </div>

      {confirmingDelete && (
        <div className="bg-surface border border-accent rounded-lg p-4 mt-3">
          <p className="text-sm mb-3">
            Supprimer definitivement le camp "{camp.name}" ? Cette action est irreversible : l'historique des
            seances de tous les membres pour ce camp sera perdu.
          </p>
          <div className="flex gap-2">
            <button
              onClick={deleteCamp}
              disabled={deleting}
              className="bg-accent hover:bg-accentSoft transition-colors text-bg font-semibold rounded-md px-3 py-1.5 text-sm disabled:opacity-60"
            >
              {deleting ? "Suppression..." : "Oui, supprimer"}
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              className="text-muted hover:text-text text-sm px-2"
            >
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
              <button
                onClick={() => setEditingDescription(false)}
                className="text-muted hover:text-text text-sm px-2"
              >
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
