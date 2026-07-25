import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";

export default function JoinCamp() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.post<{ campId: string }>("/camps/join", { code });
      navigate(`/camps/${res.campId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de rejoindre ce camp.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-sm">
      <h1 className="font-display text-3xl uppercase tracking-wide mb-1">Rejoindre un camp</h1>
      <p className="text-muted text-sm mb-6">Entre le code partage par la personne qui a cree le camp.</p>

      <form onSubmit={onSubmit} className="space-y-4">
        <input
          required
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="EX: 4F7QRT"
          className="w-full bg-surface2 border border-border rounded-md px-3 py-3 font-mono text-2xl tracking-[0.2em] text-center uppercase"
          maxLength={8}
        />

        {error && <p className="text-sm text-accent">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-accent hover:bg-accentSoft transition-colors text-bg font-semibold rounded-md py-2 disabled:opacity-60"
        >
          {busy ? "Verification..." : "Rejoindre"}
        </button>
      </form>
    </div>
  );
}
