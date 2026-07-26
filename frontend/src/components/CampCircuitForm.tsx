import { useMemo, useState } from "react";
import { api, ApiError } from "../api/client";

interface CatalogExercise {
  id: string;
  name: string;
}

interface CircuitItem {
  key: string;
  name: string;
}

export interface CampCircuitData {
  id: string;
  name: string;
  description: string | null;
  items: string; // JSON
  workSeconds: number;
  restSeconds: number;
  rounds: number;
  roundRestSeconds: number;
  recurrenceType: "DAILY" | "WEEKLY" | "EVERY_N_DAYS";
  daysOfWeek: string | null;
  intervalDays: number | null;
}

interface Props {
  campId: string;
  catalog: CatalogExercise[];
  existing?: CampCircuitData;
  onSaved: () => void;
  onCancel: () => void;
}

const WEEKDAYS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Jeu" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sam" },
  { value: 0, label: "Dim" },
];

export default function CampCircuitForm({ campId, catalog, existing, onSaved, onCancel }: Props) {
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [items, setItems] = useState<CircuitItem[]>(() => {
    if (!existing) return [];
    const parsed = JSON.parse(existing.items) as { name: string }[];
    return parsed.map((p, i) => ({ key: `${p.name}-${i}`, name: p.name }));
  });
  const [search, setSearch] = useState("");
  const [customName, setCustomName] = useState("");

  const [workSeconds, setWorkSeconds] = useState(existing?.workSeconds ?? 40);
  const [restSeconds, setRestSeconds] = useState(existing?.restSeconds ?? 20);
  const [rounds, setRounds] = useState(existing?.rounds ?? 3);
  const [roundRestSeconds, setRoundRestSeconds] = useState(existing?.roundRestSeconds ?? 60);
  const [recurrenceType, setRecurrenceType] = useState<"DAILY" | "WEEKLY" | "EVERY_N_DAYS">(
    existing?.recurrenceType ?? "DAILY"
  );
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(
    existing?.daysOfWeek ? JSON.parse(existing.daysOfWeek) : [1, 3, 5]
  );
  const [intervalDays, setIntervalDays] = useState(existing?.intervalDays ?? 2);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const filteredCatalog = useMemo(
    () => catalog.filter((e) => e.name.toLowerCase().includes(search.toLowerCase())),
    [catalog, search]
  );

  function addItem(name: string) {
    setItems((prev) => [...prev, { key: `${name}-${Date.now()}-${Math.random()}`, name }]);
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  function moveItem(key: string, direction: -1 | 1) {
    setItems((prev) => {
      const index = prev.findIndex((i) => i.key === key);
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      const copy = [...prev];
      [copy[index], copy[newIndex]] = [copy[newIndex], copy[index]];
      return copy;
    });
  }

  function toggleDay(day: number) {
    setDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  async function save() {
    setError(null);
    if (!name.trim()) {
      setError("Le nom du circuit est requis.");
      return;
    }
    if (items.length === 0) {
      setError("Ajoute au moins un exercice au circuit.");
      return;
    }
    if (recurrenceType === "WEEKLY" && daysOfWeek.length === 0) {
      setError("Choisis au moins un jour de la semaine.");
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        campId,
        name: name.trim(),
        description: description.trim() || null,
        items: items.map((i) => ({ name: i.name })),
        workSeconds,
        restSeconds,
        rounds,
        roundRestSeconds,
        recurrenceType,
      };
      if (recurrenceType === "WEEKLY") payload.daysOfWeek = daysOfWeek;
      if (recurrenceType === "EVERY_N_DAYS") payload.intervalDays = intervalDays;

      if (existing) {
        await api.put(`/camp-circuits/${existing.id}`, payload);
      } else {
        await api.post("/camp-circuits", payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'enregistrer ce circuit.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-surface2 border border-border rounded-lg p-4 space-y-3">
      <h3 className="font-display uppercase tracking-wide text-sm">
        {existing ? "Modifier le circuit" : "Nouveau circuit"}
      </h3>

      <div>
        <label className="block text-xs text-muted mb-1">Nom du circuit</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex : Circuit explosivite"
          className="w-full bg-surface border border-border rounded-md px-2 py-1.5 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs text-muted mb-1">Description (optionnel)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full bg-surface border border-border rounded-md px-2 py-1.5 text-sm resize-none"
        />
      </div>

      <div>
        <label className="block text-xs text-muted mb-1">Exercices du circuit</label>
        <input
          placeholder="Rechercher un exercice..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-surface border border-border rounded-md px-2 py-1.5 text-sm mb-1.5"
        />
        <div className="grid grid-cols-2 gap-1 max-h-28 overflow-y-auto mb-2">
          {filteredCatalog.map((exo) => (
            <button
              key={exo.id}
              type="button"
              onClick={() => addItem(exo.name)}
              className="text-left text-xs bg-surface hover:bg-border transition-colors border border-border rounded px-2 py-1"
            >
              + {exo.name}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mb-2">
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Nouvel exercice..."
            className="flex-1 bg-surface border border-border rounded-md px-2 py-1.5 text-xs"
          />
          <button
            type="button"
            onClick={() => {
              if (customName.trim()) addItem(customName.trim());
              setCustomName("");
            }}
            className="bg-accent text-bg font-semibold rounded-md px-3 py-1.5 text-xs"
          >
            Ajouter
          </button>
        </div>

        <div className="space-y-1">
          {items.map((item, index) => (
            <div key={item.key} className="flex items-center justify-between bg-surface border border-border rounded px-2 py-1 text-xs">
              <span>{index + 1}. {item.name}</span>
              <div className="flex gap-1">
                <button onClick={() => moveItem(item.key, -1)} className="text-muted hover:text-text px-1">↑</button>
                <button onClick={() => moveItem(item.key, 1)} className="text-muted hover:text-text px-1">↓</button>
                <button onClick={() => removeItem(item.key)} className="text-muted hover:text-accent px-1">✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted mb-1">Travail (sec)</label>
          <input type="number" min={5} value={workSeconds} onChange={(e) => setWorkSeconds(Number(e.target.value))} className="w-full bg-surface border border-border rounded-md px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Repos entre exercices (sec)</label>
          <input type="number" min={0} value={restSeconds} onChange={(e) => setRestSeconds(Number(e.target.value))} className="w-full bg-surface border border-border rounded-md px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Nombre de tours</label>
          <input type="number" min={1} value={rounds} onChange={(e) => setRounds(Number(e.target.value))} className="w-full bg-surface border border-border rounded-md px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Repos entre tours (sec)</label>
          <input type="number" min={0} value={roundRestSeconds} onChange={(e) => setRoundRestSeconds(Number(e.target.value))} className="w-full bg-surface border border-border rounded-md px-2 py-1.5 text-sm" />
        </div>
      </div>

      <div>
        <label className="block text-xs text-muted mb-1">Frequence</label>
        <select
          value={recurrenceType}
          onChange={(e) => setRecurrenceType(e.target.value as any)}
          className="w-full bg-surface border border-border rounded-md px-2 py-1.5 text-sm mb-2"
        >
          <option value="DAILY">Tous les jours</option>
          <option value="WEEKLY">Certains jours de la semaine</option>
          <option value="EVERY_N_DAYS">Tous les X jours</option>
        </select>
        {recurrenceType === "WEEKLY" && (
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d) => (
              <button
                type="button"
                key={d.value}
                onClick={() => toggleDay(d.value)}
                className={`px-2.5 py-1 rounded text-xs border ${
                  daysOfWeek.includes(d.value) ? "bg-accent/20 border-accent text-text" : "bg-surface border-border text-muted"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        )}
        {recurrenceType === "EVERY_N_DAYS" && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">Tous les</span>
            <input type="number" min={1} value={intervalDays} onChange={(e) => setIntervalDays(Number(e.target.value))} className="w-16 bg-surface border border-border rounded-md px-2 py-1" />
            <span className="text-muted">jours</span>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-accent">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={busy}
          className="bg-accent hover:bg-accentSoft transition-colors text-bg font-semibold rounded-md px-4 py-1.5 text-sm disabled:opacity-60"
        >
          {busy ? "Enregistrement..." : "Enregistrer"}
        </button>
        <button onClick={onCancel} className="text-muted hover:text-text text-sm px-2">
          Annuler
        </button>
      </div>
    </div>
  );
}
