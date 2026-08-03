import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";

interface PublicProfileData {
  id: string;
  name: string;
  avatarBase64: string | null;
  location: string | null;
  sport: string | null;
  sportLevel: string | null;
  overallRegularityRate: number | null;
  badgeCount: number;
  camps: { id: string; name: string; description: string | null; memberCount: number }[];
}

export default function PublicProfile() {
  const { userId } = useParams<{ userId: string }>();
  const [profile, setProfile] = useState<PublicProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    api
      .get<PublicProfileData>(`/connections/${userId}/profile`)
      .then(setProfile)
      .catch(() => setError("Vous devez etre coequipiers ou partager un camp pour voir ce profil."));
  }, [userId]);

  if (error) {
    return (
      <div className="max-w-lg">
        <p className="text-accent text-sm">{error}</p>
        <Link to="/coequipiers" className="text-accent hover:text-accentSoft text-sm">
          ← Retour
        </Link>
      </div>
    );
  }

  if (!profile) return <p className="text-muted">Chargement...</p>;

  return (
    <div className="max-w-lg">
      <Link to="/coequipiers" className="text-sm text-muted hover:text-accent">
        ← Retour aux coequipiers
      </Link>

      <div className="flex items-center gap-4 mt-3 mb-6">
        <div className="w-20 h-20 rounded-full bg-surface2 border border-border overflow-hidden flex items-center justify-center shrink-0">
          {profile.avatarBase64 ? (
            <img src={profile.avatarBase64} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl text-muted">{profile.name[0]?.toUpperCase()}</span>
          )}
        </div>
        <div>
          <h1 className="font-display text-2xl uppercase tracking-wide">{profile.name}</h1>
          {profile.location && <p className="text-muted text-sm">📍 {profile.location}</p>}
          {profile.sport && (
            <p className="text-muted text-sm">
              {profile.sport} {profile.sportLevel === "COMPETITION" ? "(competition)" : "(loisir)"}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-surface border border-border rounded-xl p-4 text-center">
          <p className="font-display text-2xl text-accent">
            {profile.overallRegularityRate != null ? `${profile.overallRegularityRate}%` : "—"}
          </p>
          <p className="text-[10px] text-muted uppercase tracking-wide mt-1">Regularite globale</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 text-center">
          <p className="font-display text-2xl text-accent">{profile.badgeCount}</p>
          <p className="text-[10px] text-muted uppercase tracking-wide mt-1">Badges obtenus</p>
        </div>
      </div>

      <h2 className="font-display uppercase tracking-wide text-sm mb-2">Camps</h2>
      <div className="space-y-2">
        {profile.camps.map((c) => (
          <div key={c.id} className="bg-surface border border-border rounded-md p-3">
            <p className="text-sm font-medium">{c.name}</p>
            {c.description && <p className="text-xs text-muted italic mt-0.5">"{c.description}"</p>}
            <p className="text-xs text-muted mt-1">{c.memberCount} membre{c.memberCount > 1 ? "s" : ""}</p>
          </div>
        ))}
        {profile.camps.length === 0 && <p className="text-muted text-sm italic">Aucun camp.</p>}
      </div>
    </div>
  );
}
