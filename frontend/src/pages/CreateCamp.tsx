import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import ExercisePicker from "../components/ExercisePicker";

export default function CreateCamp() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [creatorRole, setCreatorRole] = useState<"PLAYER" | "COACH">("PLAYER");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (selected.length === 0) {
      setError("Selectionne au moins un exercice.");
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      setError("La date de fin doit être après la date de debut.");
      return;
    }
    setBusy(true);
    try {
      const camp = await api.post<{ id: string; code: string }>("/camps", {
        name,
        description: description.trim() || null,
        exerciseIds: selected,
        startDate: startDate || null,
        endDate: endDate || null,
        creatorRole,
      });
      setCreatedCode(camp.code);
      setCreatedId(camp.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de créer le camp.");
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    if (!createdCode) return;
    await navigator.clipboard.writeText(createdCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (createdCode && createdId) {
    return (
      <div className="max-w-md">
        <h1 className="font-display text-3xl uppercase tracking-wide mb-1">Camp créé !</h1>
        <p className="text-muted text-sm mb-6">
          Partage ce code pour inviter d'autres personnes a rejoindre "{name}".
        </p>
        <div className="bg-surface border-2 border-dashed border-accent rounded-xl p-6 text-center mb-6">
          <p className="text-xs uppercase tracking-widest text-muted mb-2">Code d'invitation</p>
          <p className="font-mono text-4xl tracking-[0.3em] text-accent mb-3">{createdCode}</p>
          <button
            onClick={copyCode}
            className="text-sm bg-surface2 hover:bg-border transition-colors border border-border rounded-md px-3 py-1.5"
          >
            {copied ? "Copie !" : "📋 Copier le code"}
          </button>
        </div>
        <button
          onClick={() => navigate(`/camps/${createdId}`)}
          className="w-full bg-accent hover:bg-accentSoft transition-colors text-bg font-semibold rounded-md py-2"
        >
          Definir les consignes des exercices
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-3xl uppercase tracking-wide mb-1">Nouveau camp</h1>
      <p className="text-muted text-sm mb-6">
        Choisis un nom et les exercices qui feront partie de ce camp. En tant que créateur, tu definiras ensuite
        la consigne (objectif, fréquence) suivie par tous les membres.
      </p>

      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="name">
            Nom du camp
          </label>
          <input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex : Preparation pompiers volontaires"
            className="w-full bg-surface2 border border-border rounded-md px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="description">
            Descriptif du camp (optionnel)
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex : Preparation physique pour les tests d'entree pompiers volontaires..."
            rows={3}
            className="w-full bg-surface2 border border-border rounded-md px-3 py-2 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm text-muted mb-2">Ton role dans ce camp</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setCreatorRole("PLAYER")}
              className={`text-left p-3 rounded-md border ${
                creatorRole === "PLAYER" ? "bg-accent/15 border-accent" : "bg-surface2 border-border"
              }`}
            >
              <p className="text-sm font-medium">🏃 Coequipier</p>
              <p className="text-xs text-muted mt-0.5">Je fais aussi les exercices, comme les autres membres.</p>
            </button>
            <button
              type="button"
              onClick={() => setCreatorRole("COACH")}
              className={`text-left p-3 rounded-md border ${
                creatorRole === "COACH" ? "bg-accent/15 border-accent" : "bg-surface2 border-border"
              }`}
            >
              <p className="text-sm font-medium">📋 Entraineur</p>
              <p className="text-xs text-muted mt-0.5">
                Je ne fais pas les exercices, mais je vois la participation des autres.
              </p>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm text-muted mb-2">Exercices du camp</label>
          <ExercisePicker selected={selected} onChange={setSelected} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted mb-1" htmlFor="startDate">
              Date de debut (optionnel)
            </label>
            <input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-surface2 border border-border rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1" htmlFor="endDate">
              Date de fin (optionnel)
            </label>
            <input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-surface2 border border-border rounded-md px-3 py-2"
            />
          </div>
        </div>

        {error && <p className="text-sm text-accent">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="bg-accent hover:bg-accentSoft transition-colors text-bg font-semibold rounded-md px-5 py-2 disabled:opacity-60"
        >
          {busy ? "Création..." : "Créer le camp"}
        </button>
      </form>
    </div>
  );
}
