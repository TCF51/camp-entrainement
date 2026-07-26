import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";
import { SPORTS_LIST, SPORT_LEVELS } from "../lib/sports";

export default function Register() {
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sport, setSport] = useState("");
  const [sportLevel, setSportLevel] = useState<"LOISIR" | "COMPETITION" | "">("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/aujourdhui" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register(email, password, name, sport || null, sportLevel || null);
      navigate("/profil");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Inscription impossible, réessaie.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <img src="/logo-full.png" alt="GoTeam" className="h-24 w-auto" />
        </div>

        <div className="bg-surface border border-border rounded-xl p-6">
          <h1 className="font-display text-2xl uppercase tracking-wide mb-1">Créer un compte</h1>
          <p className="text-muted text-sm mb-6">Rejoins ou crée ton premier camp d'entraînement.</p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-muted mb-1" htmlFor="name">
                Prenom
              </label>
              <input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-text"
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-text"
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1" htmlFor="password">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-text"
              />
              <p className="text-xs text-muted mt-1">8 caractères minimum.</p>
            </div>

            <div>
              <label className="block text-sm text-muted mb-1" htmlFor="sport">
                Ton sport / activité principale (optionnel)
              </label>
              <select
                id="sport"
                value={sport}
                onChange={(e) => setSport(e.target.value)}
                className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-text"
              >
                <option value="">Je ne pratique rien en particulier / je découvre</option>
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
                        sportLevel === lvl.value
                          ? "bg-accent/20 border-accent text-text"
                          : "bg-surface2 border-border text-muted"
                      }`}
                    >
                      {lvl.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="text-sm text-accent">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-accent hover:bg-accentSoft transition-colors text-bg font-semibold rounded-md py-2 disabled:opacity-60"
            >
              {busy ? "Création..." : "Créer mon compte"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-muted mt-4">
          Déjà un compte ?{" "}
          <Link to="/connexion" className="text-accent hover:text-accentSoft">
            Connecté-toi
          </Link>
        </p>
      </div>
    </div>
  );
}
