import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";

export default function Register() {
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
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
      await register(email, password, name);
      navigate("/profil");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Inscription impossible, reessaie.");
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
          <h1 className="font-display text-2xl uppercase tracking-wide mb-1">Creer un compte</h1>
          <p className="text-muted text-sm mb-6">Rejoins ou cree ton premier camp d'entrainement.</p>

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
              <p className="text-xs text-muted mt-1">8 caracteres minimum.</p>
            </div>

            {error && <p className="text-sm text-accent">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-accent hover:bg-accentSoft transition-colors text-bg font-semibold rounded-md py-2 disabled:opacity-60"
            >
              {busy ? "Creation..." : "Creer mon compte"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-muted mt-4">
          Deja un compte ?{" "}
          <Link to="/connexion" className="text-accent hover:text-accentSoft">
            Connecte-toi
          </Link>
        </p>
      </div>
    </div>
  );
}
