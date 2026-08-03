import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { EQUIPMENT_CATALOG } from "../lib/equipment";

interface CampPreview {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  exerciseNames: string[];
  requiredEquipment: string[];
}

export default function JoinCamp() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<CampPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const myEquipment: string[] = user?.equipment ? JSON.parse(user.equipment) : [];
  const missingEquipment = preview?.requiredEquipment.filter((eq) => eq !== "AUCUN" && !myEquipment.includes(eq)) ?? [];

  async function onPreview(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.get<CampPreview>(`/camps/preview?code=${encodeURIComponent(code)}`);
      setPreview(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de trouver ce camp.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmJoin() {
    if (!preview) return;
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

  function equipmentLabel(key: string): string {
    return EQUIPMENT_CATALOG.find((e) => e.key === key)?.label ?? key;
  }

  if (preview) {
    return (
      <div className="max-w-sm">
        <h1 className="font-display text-3xl uppercase tracking-wide mb-1">{preview.name}</h1>
        {preview.description && <p className="text-muted text-sm mb-3 italic">"{preview.description}"</p>}
        <p className="text-muted text-sm mb-4">
          {preview.memberCount} membre{preview.memberCount > 1 ? "s" : ""} · {preview.exerciseNames.join(", ")}
        </p>

        {missingEquipment.length > 0 && (
          <div className="bg-surface2 border border-accent rounded-lg p-3 mb-4">
            <p className="text-sm mb-1">⚠️ Materiel manquant selon ton profil :</p>
            <p className="text-sm text-muted">{missingEquipment.map(equipmentLabel).join(", ")}</p>
            <p className="text-xs text-muted mt-2">Tu peux quand meme rejoindre le camp si tu le souhaites.</p>
          </div>
        )}

        {error && <p className="text-sm text-accent mb-3">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={confirmJoin}
            disabled={busy}
            className="flex-1 bg-accent hover:bg-accentSoft transition-colors text-bg font-semibold rounded-md py-2 disabled:opacity-60"
          >
            {busy ? "Inscription..." : "Rejoindre quand meme"}
          </button>
          <button onClick={() => setPreview(null)} className="text-muted hover:text-text text-sm px-3">
            Annuler
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-sm">
      <h1 className="font-display text-3xl uppercase tracking-wide mb-1">Rejoindre un camp</h1>
      <p className="text-muted text-sm mb-6">Entre le code partage par la personne qui a créé le camp.</p>

      <form onSubmit={onPreview} className="space-y-4">
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
