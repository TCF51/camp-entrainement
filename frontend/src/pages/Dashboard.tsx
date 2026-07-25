import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

interface CampSummary {
  id: string;
  name: string;
  code: string;
  exercises: { exercise: { id: string; name: string } }[];
  _count: { members: number };
}

export default function Dashboard() {
  const [camps, setCamps] = useState<CampSummary[] | null>(null);

  useEffect(() => {
    api.get<CampSummary[]>("/camps/mine").then(setCamps);
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-wide mb-1">Mes camps</h1>
          <p className="text-muted text-sm">Les groupes d'entrainement auxquels tu participes.</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/camps/rejoindre"
            className="bg-surface2 hover:bg-border transition-colors border border-border rounded-md px-4 py-2 text-sm"
          >
            Integrer un camp
          </Link>
          <Link
            to="/camps/creer"
            className="bg-accent hover:bg-accentSoft transition-colors text-bg font-semibold rounded-md px-4 py-2 text-sm"
          >
            + Nouveau camp
          </Link>
        </div>
      </div>

      {camps === null && <p className="text-muted">Chargement...</p>}

      {camps?.length === 0 && (
        <div className="bg-surface border border-dashed border-border rounded-xl p-8 text-center">
          <p className="font-display text-xl uppercase tracking-wide mb-2">Aucun camp pour l'instant</p>
          <p className="text-muted text-sm mb-5">
            Cree ton premier camp d'entrainement, ou rejoins celui de quelqu'un d'autre avec son code.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {camps?.map((camp) => (
          <Link
            key={camp.id}
            to={`/camps/${camp.id}`}
            className="bg-surface border border-border rounded-xl p-5 hover:border-accent/50 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-lg uppercase tracking-wide">{camp.name}</h2>
              <span className="font-mono text-xs bg-surface2 border border-border rounded px-2 py-1 text-muted">
                {camp.code}
              </span>
            </div>
            <p className="text-sm text-muted mb-1">
              {camp.exercises.length} exercice{camp.exercises.length > 1 ? "s" : ""} · {camp._count.members} membre
              {camp._count.members > 1 ? "s" : ""}
            </p>
            <p className="text-xs text-muted truncate">
              {camp.exercises.map((e) => e.exercise.name).join(" · ")}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
