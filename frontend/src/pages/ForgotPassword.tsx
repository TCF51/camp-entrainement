import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const res = await api.post<{ message: string }>("/auth/forgot-password", { email });
      setMessage(res.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
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
          <h1 className="font-display text-2xl uppercase tracking-wide mb-1">Mot de passe oublie</h1>
          <p className="text-muted text-sm mb-6">
            Entre ton email, on t'envoie un lien pour choisir un nouveau mot de passe.
          </p>

          {message ? (
            <p className="text-sm text-success">{message}</p>
          ) : (
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

              {error && <p className="text-sm text-accent">{error}</p>}

              <button
                type="submit"
                disabled={busy}
                className="w-full bg-accent hover:bg-accentSoft transition-colors text-bg font-semibold rounded-md py-2 disabled:opacity-60"
              >
                {busy ? "Envoi..." : "Envoyer le lien"}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-muted mt-4">
          <Link to="/connexion" className="text-accent hover:text-accentSoft">
            Retour a la connexion
          </Link>
        </p>
      </div>
    </div>
  );
}
