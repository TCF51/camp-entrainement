import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api/client";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const res = await api.post<{ message: string }>("/auth/reset-password", { token, newPassword });
      setMessage(res.message);
      setTimeout(() => navigate("/connexion"), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de réinitialiser le mot de passe.");
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
          <h1 className="font-display text-2xl uppercase tracking-wide mb-1">Nouveau mot de passe</h1>

          {!token ? (
            <p className="text-sm text-accent">
              Lien invalide. Redemande un lien de réinitialisation depuis la page de connexion.
            </p>
          ) : message ? (
            <p className="text-sm text-success">{message} Redirection...</p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-muted mb-1" htmlFor="newPassword">
                  Nouveau mot de passe
                </label>
                <input
                  id="newPassword"
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-text"
                />
                <p className="text-xs text-muted mt-1">8 caractères minimum.</p>
              </div>

              {error && <p className="text-sm text-accent">{error}</p>}

              <button
                type="submit"
                disabled={busy}
                className="w-full bg-accent hover:bg-accentSoft transition-colors text-bg font-semibold rounded-md py-2 disabled:opacity-60"
              >
                {busy ? "Enregistrement..." : "Changer le mot de passe"}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-muted mt-4">
          <Link to="/connexion" className="text-accent hover:text-accentSoft">
            Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  );
}
