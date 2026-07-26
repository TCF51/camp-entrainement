import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import CircuitRunner from "../components/CircuitRunner";

interface CatalogExercise {
  id: string;
  name: string;
  unit: "REPS" | "SECONDS";
}

interface CircuitItem {
  key: string;
  name: string;
}

interface NewBadge {
  key: string;
  name: string;
  description: string;
  emoji: string;
}

export default function Chrono() {
  const [mode, setMode] = useState<"circuit" | "simple">("circuit");

  const [catalog, setCatalog] = useState<CatalogExercise[]>([]);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<CircuitItem[]>([]);
  const [customName, setCustomName] = useState("");

  const [workSeconds, setWorkSeconds] = useState(40);
  const [restSeconds, setRestSeconds] = useState(20);
  const [rounds, setRounds] = useState(3);
  const [roundRestSeconds, setRoundRestSeconds] = useState(60);

  const [isRunningCircuit, setIsRunningCircuit] = useState(false);
  const [celebrating, setCelebrating] = useState<NewBadge[]>([]);

  useEffect(() => {
    api.get<CatalogExercise[]>("/exercises").then(setCatalog);
  }, []);

  const filteredCatalog = useMemo(
    () => catalog.filter((e) => e.name.toLowerCase().includes(search.toLowerCase())),
    [catalog, search]
  );

  function addItem(name: string) {
    setItems((prev) => [...prev, { key: `${name}-${Date.now()}-${Math.random()}`, name }]);
  }

  async function addCustom() {
    if (!customName.trim()) return;
    try {
      const created = await api.post<CatalogExercise>("/exercises", { name: customName.trim(), unit: "REPS" });
      setCatalog((prev) => [...prev, created]);
      addItem(created.name);
    } catch {
      addItem(customName.trim());
    }
    setCustomName("");
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

  async function onCircuitComplete(totalDurationSeconds: number) {
    setIsRunningCircuit(false);
    try {
      const res = await api.post<{ newBadges: NewBadge[] }>("/chrono-sessions", {
        items: items.map((i) => i.name),
        workSeconds,
        restSeconds,
        rounds,
        roundRestSeconds,
        totalDurationSeconds,
      });
      if (res.newBadges?.length) setCelebrating(res.newBadges);
    } catch {
      // meme si l'enregistrement echoue (ex: hors ligne), on ne bloque pas l'utilisateur
    }
  }

  if (isRunningCircuit) {
    return (
      <div className="max-w-md mx-auto">
        <CircuitRunner
          items={items.map((i) => ({ name: i.name }))}
          workSeconds={workSeconds}
          restSeconds={restSeconds}
          rounds={rounds}
          roundRestSeconds={roundRestSeconds}
          onComplete={onCircuitComplete}
          onCancel={() => setIsRunningCircuit(false)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      {celebrating.length > 0 && (
        <div className="bg-accent/10 border border-accent rounded-xl p-4 mb-5">
          {celebrating.map((b) => (
            <p key={b.key} className="text-sm">
              <span className="text-xl mr-2">{b.emoji}</span>
              Nouveau badge : <span className="font-semibold">{b.name}</span> — {b.description}
            </p>
          ))}
          <button onClick={() => setCelebrating([])} className="text-xs text-muted hover:text-text mt-2">
            Fermer
          </button>
        </div>
      )}

      <h1 className="font-display text-3xl uppercase tracking-wide mb-1">Chronometre</h1>
      <p className="text-muted text-sm mb-4">
        Construis ta propre seance en circuit training, ou lance simplement un chrono.
      </p>

      <div className="flex gap-1.5 mb-6">
        <button
          onClick={() => setMode("circuit")}
          className={`px-3 py-1.5 rounded text-sm border ${
            mode === "circuit" ? "bg-accent/20 border-accent text-text" : "bg-surface border-border text-muted"
          }`}
        >
          Circuit training
        </button>
        <button
          onClick={() => setMode("simple")}
          className={`px-3 py-1.5 rounded text-sm border ${
            mode === "simple" ? "bg-accent/20 border-accent text-text" : "bg-surface border-border text-muted"
          }`}
        >
          Chrono simple
        </button>
      </div>

      {mode === "simple" ? (
        <SimpleTimer />
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h2 className="font-display uppercase tracking-wide text-sm mb-2">1. Choisis tes exercices</h2>
            <input
              placeholder="Rechercher un exercice..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface2 border border-border rounded-md px-3 py-2 mb-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto mb-2">
              {filteredCatalog.map((exo) => (
                <button
                  key={exo.id}
                  type="button"
                  onClick={() => addItem(exo.name)}
                  className="text-left text-sm bg-surface2 hover:bg-border transition-colors border border-border rounded-md px-2 py-1.5"
                >
                  + {exo.name}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Nouvel exercice..."
                className="flex-1 bg-surface2 border border-border rounded-md px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={addCustom}
                className="bg-accent text-bg font-semibold rounded-md px-3 py-1.5 text-sm"
              >
                Ajouter
              </button>
            </div>

            <h3 className="font-display uppercase tracking-wide text-xs mt-4 mb-2 text-muted">
              Circuit ({items.length} exercice{items.length > 1 ? "s" : ""})
            </h3>
            <div className="space-y-1.5">
              {items.length === 0 && <p className="text-muted text-sm italic">Aucun exercice ajoute pour l'instant.</p>}
              {items.map((item, index) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between bg-surface border border-border rounded-md px-3 py-1.5 text-sm"
                >
                  <span>
                    {index + 1}. {item.name}
                  </span>
                  <div className="flex gap-1 items-center">
                    <button onClick={() => moveItem(item.key, -1)} className="text-muted hover:text-text px-1">
                      ↑
                    </button>
                    <button onClick={() => moveItem(item.key, 1)} className="text-muted hover:text-text px-1">
                      ↓
                    </button>
                    <button onClick={() => removeItem(item.key)} className="text-muted hover:text-accent px-1">
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-display uppercase tracking-wide text-sm mb-2">2. Reglages du circuit</h2>
            <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
              <div>
                <label className="block text-xs text-muted mb-1">Temps de travail (secondes)</label>
                <input
                  type="number"
                  min={5}
                  value={workSeconds}
                  onChange={(e) => setWorkSeconds(Number(e.target.value))}
                  className="w-full bg-surface2 border border-border rounded-md px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Temps de repos entre exercices (secondes)</label>
                <input
                  type="number"
                  min={0}
                  value={restSeconds}
                  onChange={(e) => setRestSeconds(Number(e.target.value))}
                  className="w-full bg-surface2 border border-border rounded-md px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Nombre de tours</label>
                <input
                  type="number"
                  min={1}
                  value={rounds}
                  onChange={(e) => setRounds(Number(e.target.value))}
                  className="w-full bg-surface2 border border-border rounded-md px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Repos entre chaque tour (secondes)</label>
                <input
                  type="number"
                  min={0}
                  value={roundRestSeconds}
                  onChange={(e) => setRoundRestSeconds(Number(e.target.value))}
                  className="w-full bg-surface2 border border-border rounded-md px-2 py-1.5 text-sm"
                />
              </div>
            </div>

            <button
              onClick={() => setIsRunningCircuit(true)}
              disabled={items.length === 0}
              className="w-full mt-4 bg-accent hover:bg-accentSoft transition-colors text-bg font-semibold rounded-md py-2.5 disabled:opacity-50"
            >
              Lancer le circuit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Chrono simple : un minuteur (compte a rebours) ou chronometre (compte en avant si duree = 0),
// pour un usage ponctuel sans construire tout un circuit.
function SimpleTimer() {
  const [inputMinutes, setInputMinutes] = useState(1);
  const [inputSeconds, setInputSeconds] = useState(0);
  const [remaining, setRemaining] = useState(60);
  const [running, setRunning] = useState(false);
  const [countUp, setCountUp] = useState(false);
  const intervalRef = useRef<number | null>(null);

  function applySettings() {
    const total = inputMinutes * 60 + inputSeconds;
    setCountUp(total === 0);
    setRemaining(total === 0 ? 0 : total);
    setRunning(false);
  }

  useEffect(() => {
    if (!running) return;
    intervalRef.current = window.setInterval(() => {
      setRemaining((r) => {
        if (countUp) return r + 1;
        if (r <= 1) {
          setRunning(false);
          try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            osc.frequency.value = 660;
            osc.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.4);
            osc.onended = () => ctx.close();
          } catch {
            /* pas grave si pas de son */
          }
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [running, countUp]);

  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;

  return (
    <div className="max-w-sm mx-auto text-center">
      <div className="border-4 border-accent rounded-full w-56 h-56 mx-auto flex flex-col items-center justify-center my-6">
        <p className="font-display text-6xl">
          {mm}:{ss.toString().padStart(2, "0")}
        </p>
      </div>

      <div className="flex justify-center gap-3 mb-6">
        <button
          onClick={() => setRunning((r) => !r)}
          className="bg-accent hover:bg-accentSoft transition-colors text-bg font-semibold rounded-md px-5 py-2"
        >
          {running ? "Pause" : "Demarrer"}
        </button>
        <button
          onClick={applySettings}
          className="bg-surface2 hover:bg-border transition-colors border border-border rounded-md px-4 py-2 text-sm"
        >
          Reinitialiser
        </button>
      </div>

      <div className="bg-surface border border-border rounded-lg p-4">
        <p className="text-xs text-muted mb-2">
          Regle une duree pour un compte a rebours, ou laisse 0:00 pour un chronometre qui compte en avant.
        </p>
        <div className="flex items-center justify-center gap-2">
          <input
            type="number"
            min={0}
            value={inputMinutes}
            onChange={(e) => setInputMinutes(Number(e.target.value))}
            className="w-16 bg-surface2 border border-border rounded-md px-2 py-1.5 text-sm text-center"
          />
          <span className="text-muted text-sm">min</span>
          <input
            type="number"
            min={0}
            max={59}
            value={inputSeconds}
            onChange={(e) => setInputSeconds(Number(e.target.value))}
            className="w-16 bg-surface2 border border-border rounded-md px-2 py-1.5 text-sm text-center"
          />
          <span className="text-muted text-sm">sec</span>
          <button
            onClick={applySettings}
            className="bg-surface2 hover:bg-border transition-colors border border-border rounded-md px-3 py-1.5 text-sm"
          >
            Appliquer
          </button>
        </div>
      </div>
    </div>
  );
}
