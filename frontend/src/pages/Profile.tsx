import { FormEvent, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../api/client";
import { enablePushNotifications } from "../lib/push";

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [weightKg, setWeightKg] = useState(user?.weightKg?.toString() ?? "");
  const [heightCm, setHeightCm] = useState(user?.heightCm?.toString() ?? "");
  const [birthDate, setBirthDate] = useState(user?.birthDate?.slice(0, 10) ?? "");
  const [sex, setSex] = useState(user?.sex ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      await api.put("/users/me", {
        weightKg: weightKg ? Number(weightKg) : null,
        heightCm: heightCm ? Number(heightCm) : null,
        birthDate: birthDate || null,
        sex: sex || null,
      });
      await refreshUser();
      setMessage("Profil mis a jour.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de mettre a jour le profil.");
    } finally {
      setBusy(false);
    }
  }

  async function onEnableNotifications() {
    setMessage(null);
    setError(null);
    try {
      const result = await enablePushNotifications();
      setMessage(result);
    } catch {
      setError("Impossible d'activer les notifications sur cet appareil.");
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="font-display text-3xl uppercase tracking-wide mb-1">Mon profil</h1>
      <p className="text-muted text-sm mb-6">Ces infos sont juste pour toi, pas partagees avec les autres membres.</p>

      <form onSubmit={onSubmit} className="bg-surface border border-border rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted mb-1" htmlFor="weight">
              Poids (kg)
            </label>
            <input
              id="weight"
              type="number"
              step="0.1"
              min="0"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              className="w-full bg-surface2 border border-border rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1" htmlFor="height">
              Taille (cm)
            </label>
            <input
              id="height"
              type="number"
              step="0.1"
              min="0"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              className="w-full bg-surface2 border border-border rounded-md px-3 py-2"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="birthDate">
            Date de naissance
          </label>
          <input
            id="birthDate"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="w-full bg-surface2 border border-border rounded-md px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="sex">
            Sexe (optionnel)
          </label>
          <select
            id="sex"
            value={sex}
            onChange={(e) => setSex(e.target.value)}
            className="w-full bg-surface2 border border-border rounded-md px-3 py-2"
          >
            <option value="">Ne souhaite pas preciser</option>
            <option value="F">Femme</option>
            <option value="M">Homme</option>
            <option value="AUTRE">Autre</option>
          </select>
        </div>

        {message && <p className="text-sm text-success">{message}</p>}
        {error && <p className="text-sm text-accent">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="bg-accent hover:bg-accentSoft transition-colors text-bg font-semibold rounded-md px-5 py-2 disabled:opacity-60"
        >
          {busy ? "Enregistrement..." : "Enregistrer"}
        </button>
      </form>

      <div className="bg-surface border border-border rounded-xl p-6 mt-6">
        <h2 className="font-display text-lg uppercase tracking-wide mb-1">Rappels</h2>
        <p className="text-muted text-sm mb-4">
          Active les notifications pour recevoir un rappel les jours ou une seance est prevue.
        </p>
        <button
          onClick={onEnableNotifications}
          className="bg-surface2 hover:bg-border transition-colors border border-border rounded-md px-4 py-2 text-sm"
        >
          Activer les notifications
        </button>
      </div>
    </div>
  );
}
