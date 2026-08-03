import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

interface UserSummary {
  id: string;
  name: string;
  avatarBase64: string | null;
  location: string | null;
}

interface ConnectionsData {
  accepted: { connectionId: string; user: UserSummary }[];
  pendingSent: { connectionId: string; user: UserSummary }[];
  pendingReceived: { connectionId: string; user: UserSummary }[];
}

export default function Teammates() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<UserSummary[]>([]);
  const [data, setData] = useState<ConnectionsData | null>(null);
  const [sentTo, setSentTo] = useState<string[]>([]);

  function load() {
    api.get<ConnectionsData>("/connections").then(setData);
  }
  useEffect(load, []);

  useEffect(() => {
    if (search.trim().length < 2) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      api.get<UserSummary[]>(`/users/search?q=${encodeURIComponent(search.trim())}`).then(setResults);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  async function sendRequest(userId: string) {
    await api.post("/connections", { recipientId: userId });
    setSentTo((prev) => [...prev, userId]);
  }

  async function accept(connectionId: string) {
    await api.post(`/connections/${connectionId}/accept`, {});
    load();
  }

  async function remove(connectionId: string) {
    await api.del(`/connections/${connectionId}`);
    load();
  }

  const allKnownIds = new Set([
    ...(data?.accepted.map((c) => c.user.id) ?? []),
    ...(data?.pendingSent.map((c) => c.user.id) ?? []),
    ...(data?.pendingReceived.map((c) => c.user.id) ?? []),
  ]);

  return (
    <div className="max-w-lg">
      <h1 className="font-display text-3xl uppercase tracking-wide mb-1">Coequipiers</h1>
      <p className="text-muted text-sm mb-6">
        Recherche une personne par son nom pour lui proposer de devenir coequipier et acceder a son profil.
      </p>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher par nom..."
        className="w-full bg-surface2 border border-border rounded-md px-3 py-2 mb-3"
      />

      {results.length > 0 && (
        <div className="space-y-2 mb-6">
          {results.map((u) => (
            <div key={u.id} className="flex items-center justify-between bg-surface border border-border rounded-md p-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-surface2 border border-border overflow-hidden flex items-center justify-center shrink-0">
                  {u.avatarBase64 ? (
                    <img src={u.avatarBase64} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs text-muted">{u.name[0]?.toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <p className="text-sm">{u.name}</p>
                  {u.location && <p className="text-xs text-muted">{u.location}</p>}
                </div>
              </div>
              {allKnownIds.has(u.id) || sentTo.includes(u.id) ? (
                <span className="text-xs text-muted">Demande envoyee</span>
              ) : (
                <button
                  onClick={() => sendRequest(u.id)}
                  className="text-xs bg-accent text-bg font-semibold rounded-md px-3 py-1.5"
                >
                  + Ajouter
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {data && data.pendingReceived.length > 0 && (
        <div className="mb-6">
          <h2 className="font-display uppercase tracking-wide text-sm mb-2">Demandes recues</h2>
          <div className="space-y-2">
            {data.pendingReceived.map((c) => (
              <div key={c.connectionId} className="flex items-center justify-between bg-surface border border-border rounded-md p-3">
                <p className="text-sm">{c.user.name}</p>
                <div className="flex gap-2">
                  <button onClick={() => accept(c.connectionId)} className="text-xs bg-accent text-bg font-semibold rounded-md px-3 py-1.5">
                    Accepter
                  </button>
                  <button onClick={() => remove(c.connectionId)} className="text-xs text-muted hover:text-accent">
                    Refuser
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="font-display uppercase tracking-wide text-sm mb-2">Mes coequipiers</h2>
      {data === null && <p className="text-muted text-sm">Chargement...</p>}
      {data?.accepted.length === 0 && <p className="text-muted text-sm italic">Aucun coequipier pour l'instant.</p>}
      <div className="space-y-2">
        {data?.accepted.map((c) => (
          <Link
            key={c.connectionId}
            to={`/profil/${c.user.id}`}
            className="flex items-center justify-between bg-surface hover:bg-surface2 transition-colors border border-border rounded-md p-3"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-surface2 border border-border overflow-hidden flex items-center justify-center shrink-0">
                {c.user.avatarBase64 ? (
                  <img src={c.user.avatarBase64} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-muted">{c.user.name[0]?.toUpperCase()}</span>
                )}
              </div>
              <p className="text-sm">{c.user.name}</p>
            </div>
            <span className="text-xs text-accent">Voir le profil →</span>
          </Link>
        ))}
      </div>

      {data && data.pendingSent.length > 0 && (
        <div className="mt-6">
          <h2 className="font-display uppercase tracking-wide text-sm mb-2">Demandes envoyees (en attente)</h2>
          <div className="space-y-2">
            {data.pendingSent.map((c) => (
              <div key={c.connectionId} className="flex items-center justify-between bg-surface border border-border rounded-md p-3">
                <p className="text-sm text-muted">{c.user.name}</p>
                <button onClick={() => remove(c.connectionId)} className="text-xs text-muted hover:text-accent">
                  Annuler
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
