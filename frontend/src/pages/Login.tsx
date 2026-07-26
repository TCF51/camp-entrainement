import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/aujourdhui" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate("/aujourdhui");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Connexion impossible, réessaie.");
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
          <h1 className="font-display text-2xl uppercase tracking-wide mb-1">Connexion</h1>
          <p className="text-muted text-sm mb-6">Reprends ton entraînement la ou tu l'as laisse.</p>

          <form onSubmit={onSubmit} className="space-y-4">
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
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm text-muted" htmlFor="password">
                  Mot de passe
                </label>
                <Link to="/mot-de-passe-oublie" className="text-xs text-accent hover:text-accentSoft">
                  Oublié ?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-text"
              />
            </div>

            {error && <p className="text-sm text-accent">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-accent hover:bg-accentSoft transition-colors text-bg font-semibold rounded-md py-2 disabled:opacity-60"
            >
              {busy ? "Connexion..." : "Se connecter"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-muted mt-4">
          Pas encore de compte ?{" "}
          <Link to="/inscription" className="text-accent hover:text-accentSoft">
            Crée-en un
          </Link>
        </p>
      </div>
    </div>
  );
}
