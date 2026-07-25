import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import ExercisePicker from "../components/ExercisePicker";

export default function CreateCamp() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (selected.length === 0) {
      setError("Selectionne au moins un exercice.");
      return;
    }
    setBusy(true);
    try {
      const camp = await api.post<{ id: string; code: string }>("/camps", { name, exerciseIds: selected });
      setCreatedCode(camp.code);
      setCreatedId(camp.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de creer le camp.");
    } finally {
      setBusy(false);
    }
  }

  if (createdCode && createdId) {
    return (
      <div className="max-w-md">
        <h1 className="font-display text-3xl uppercase tracking-wide mb-1">Camp cree !</h1>
        <p className="text-muted text-sm mb-6">
          Partage ce code pour inviter d'autres personnes a rejoindre "{name}".
        </p>
        <div className="bg-surface border-2 border-dashed border-accent rounded-xl p-6 text-center mb-6">
          <p className="text-xs uppercase tracking-widest text-muted mb-2">Code d'invitation</p>
          <p className="font-mono text-4xl tracking-[0.3em] text-accent">{createdCode}</p>
        </div>
        <button
          onClick={() => navigate(`/camps/${createdId}`)}
          className="w-full bg-accent hover:bg-accentSoft transition-colors text-bg font-semibold rounded-md py-2"
        >
          Configurer mon programme
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-3xl uppercase tracking-wide mb-1">Nouveau camp</h1>
      <p className="text-muted text-sm mb-6">
        Choisis un nom et les exercices qui feront partie de ce camp. Chaque membre pourra ensuite definir son
        propre nombre de series/repetitions et sa propre frequence.
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
          <label className="block text-sm text-muted mb-2">Exercices du camp</label>
          <ExercisePicker selected={selected} onChange={setSelected} />
        </div>

        {error && <p className="text-sm text-accent">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="bg-accent hover:bg-accentSoft transition-colors text-bg font-semibold rounded-md px-5 py-2 disabled:opacity-60"
        >
          {busy ? "Creation..." : "Creer le camp"}
        </button>
      </form>
    </div>
  );
}
