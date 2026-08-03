import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../api/client";
import { enablePushNotifications } from "../lib/push";
import { resizeImageFile } from "../lib/image";
import { SPORTS_LIST, SPORT_LEVELS } from "../lib/sports";
import { EQUIPMENT_CATALOG } from "../lib/equipment";

interface Badge {
  key: string;
  name: string;
  description: string;
  emoji: string;
  earned: boolean;
  earnedAt: string | null;
}

interface CampSummary {
  id: string;
  name: string;
  description: string | null;
  role: "COACH" | "PLAYER";
  memberCount: number;
  exercises: string[];
}

export default function Profile() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [weightKg, setWeightKg] = useState(user?.weightKg?.toString() ?? "");
  const [heightCm, setHeightCm] = useState(user?.heightCm?.toString() ?? "");
  const [birthDate, setBirthDate] = useState(user?.birthDate?.slice(0, 10) ?? "");
  const [sex, setSex] = useState(user?.sex ?? "");
  const [sport, setSport] = useState(user?.sport ?? "");
  const [sportLevel, setSportLevel] = useState(user?.sportLevel ?? "");
  const [location, setLocation] = useState(user?.location ?? "");
  const [equipment, setEquipment] = useState<string[]>(user?.equipment ? JSON.parse(user.equipment) : []);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [badges, setBadges] = useState<Badge[] | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [summary, setSummary] = useState<{ overallRegularityRate: number | null; camps: CampSummary[] } | null>(null);

  useEffect(() => {
    api.get<Badge[]>("/badges").then(setBadges);
    api.get<{ overallRegularityRate: number | null; camps: CampSummary[] }>("/users/me/summary").then(setSummary);
  }, []);

  function toggleEquipment(key: string) {
    setEquipment((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

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
        sport: sport || null,
        sportLevel: sportLevel || null,
        location: location.trim() || null,
        equipment: equipment.length > 0 ? equipment : null,
      });
      await refreshUser();
      setMessage("Profil mis à jour.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de mettre à jour le profil.");
    } finally {
      setBusy(false);
    }
  }

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    setError(null);
    try {
      const dataUrl = await resizeImageFile(file);
      await api.put("/users/me", { avatarBase64: dataUrl });
      await refreshUser();
    } catch {
      setError("Impossible de mettre à jour la photo de profil.");
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeAvatar() {
    setAvatarUploading(true);
    try {
      await api.put("/users/me", { avatarBase64: null });
      await refreshUser();
    } finally {
      setAvatarUploading(false);
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

  function onLogout() {
    logout();
    navigate("/connexion");
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h1 className="font-display text-3xl uppercase tracking-wide">Mon profil</h1>
        <button onClick={onLogout} className="text-sm text-muted hover:text-accent transition-colors shrink-0">
          Se déconnecter
        </button>
      </div>
      <p className="text-muted text-sm mb-6">Ces infos sont juste pour toi, pas partagees avec les autres membres.</p>

      <div className="flex gap-2 mb-6 md:hidden">
        <Link
          to="/exercices"
          className="flex-1 text-center bg-surface2 hover:bg-border transition-colors border border-border rounded-md px-3 py-2 text-sm"
        >
          📚 Exercices
        </Link>
        <Link
          to="/historique"
          className="flex-1 text-center bg-surface2 hover:bg-border transition-colors border border-border rounded-md px-3 py-2 text-sm"
        >
          📈 Historique
        </Link>
      </div>

      <Link
        to="/coequipiers"
        className="block mb-6 text-center bg-surface2 hover:bg-border transition-colors border border-border rounded-md px-3 py-2 text-sm"
      >
        🤝 Mes coequipiers
      </Link>

      <div className="bg-surface border border-border rounded-xl p-6 mb-6 flex items-center gap-4">
        <div className="w-20 h-20 rounded-full bg-surface2 border border-border overflow-hidden flex items-center justify-center shrink-0">
          {user?.avatarBase64 ? (
            <img src={user.avatarBase64} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl text-muted">{user?.name?.[0]?.toUpperCase() ?? "?"}</span>
          )}
        </div>
        <div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={onAvatarChange} className="hidden" id="avatarInput" />
          <label
            htmlFor="avatarInput"
            className="inline-block cursor-pointer bg-surface2 hover:bg-border transition-colors border border-border rounded-md px-3 py-1.5 text-sm"
          >
            {avatarUploading ? "..." : "Changer la photo"}
          </label>
          {user?.avatarBase64 && (
            <button onClick={removeAvatar} disabled={avatarUploading} className="block text-xs text-muted hover:text-accent mt-1">
              Retirer la photo
            </button>
          )}
        </div>
      </div>

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
            <option value="">Ne souhaite pas préciser</option>
            <option value="F">Femme</option>
            <option value="M">Homme</option>
            <option value="AUTRE">Autre</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="sport">
            Sport / activité principale
          </label>
          <select
            id="sport"
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            className="w-full bg-surface2 border border-border rounded-md px-3 py-2"
          >
            <option value="">Non précise</option>
            {SPORTS_LIST.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {sport && (
          <div>
            <label className="block text-sm text-muted mb-1">Niveau de pratique</label>
            <div className="flex gap-2">
              {SPORT_LEVELS.map((lvl) => (
                <button
                  type="button"
                  key={lvl.value}
                  onClick={() => setSportLevel(lvl.value)}
                  className={`flex-1 text-xs px-3 py-2 rounded-md border ${
                    sportLevel === lvl.value ? "bg-accent/20 border-accent text-text" : "bg-surface2 border-border text-muted"
                  }`}
                >
                  {lvl.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="location">
            Localisation (optionnel)
          </label>
          <input
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Ex : Angers"
            className="w-full bg-surface2 border border-border rounded-md px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm text-muted mb-2">Materiel dont je dispose</label>
          <div className="flex flex-wrap gap-1.5">
            {EQUIPMENT_CATALOG.map((eq) => (
              <button
                type="button"
                key={eq.key}
                onClick={() => toggleEquipment(eq.key)}
                className={`text-xs px-2.5 py-1.5 rounded-md border ${
                  equipment.includes(eq.key) ? "bg-accent/20 border-accent text-text" : "bg-surface2 border-border text-muted"
                }`}
              >
                {eq.label}
              </button>
            ))}
          </div>
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
          Active les notifications pour recevoir un rappel les jours ou une séance est prevue.
        </p>
        <button
          onClick={onEnableNotifications}
          className="bg-surface2 hover:bg-border transition-colors border border-border rounded-md px-4 py-2 text-sm"
        >
          Activer les notifications
        </button>
      </div>
      <div className="bg-surface border border-border rounded-xl p-6 mt-6">
        <h2 className="font-display text-lg uppercase tracking-wide mb-1">Mes camps</h2>
        <p className="text-muted text-sm mb-4">
          Taux de régularité global
          {summary?.overallRegularityRate != null ? (
            <span className="text-accent font-semibold"> · {summary.overallRegularityRate}%</span>
          ) : (
            <span className="italic"> · pas encore assez de recul</span>
          )}
        </p>
        {summary === null && <p className="text-muted text-sm">Chargement...</p>}
        {summary?.camps.length === 0 && <p className="text-muted text-sm italic">Aucun camp pour l'instant.</p>}
        <div className="space-y-2">
          {summary?.camps.map((c) => (
            <Link
              key={c.id}
              to={`/camps/${c.id}`}
              className="block bg-surface2 hover:bg-border transition-colors border border-border rounded-md p-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{c.name}</p>
                <span className="text-[10px] uppercase tracking-wide text-muted">
                  {c.role === "COACH" ? "Entraineur" : "Coequipier"}
                </span>
              </div>
              {c.description && <p className="text-xs text-muted italic mt-0.5">"{c.description}"</p>}
              <p className="text-xs text-muted mt-1">
                {c.memberCount} membre{c.memberCount > 1 ? "s" : ""} · {c.exercises.join(", ")}
              </p>
            </Link>
          ))}
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-6 mt-6">
        <h2 className="font-display text-lg uppercase tracking-wide mb-1">Mes badges</h2>
        <p className="text-muted text-sm mb-4">
          Bases sur ta régularité personnelle uniquement, pas de comparaison avec les autres membres.
        </p>
        {badges === null && <p className="text-muted text-sm">Chargement...</p>}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {badges?.map((b) => (
            <div
              key={b.key}
              title={b.description}
              className={`rounded-lg p-3 text-center border ${
                b.earned ? "bg-accent/10 border-accent" : "bg-surface2 border-border opacity-40"
              }`}
            >
              <p className="text-2xl mb-1">{b.emoji}</p>
              <p className="text-xs font-medium">{b.name}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
