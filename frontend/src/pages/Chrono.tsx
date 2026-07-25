import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";

interface CatalogExercise {
  id: string;
  name: string;
  unit: "REPS" | "SECONDS";
}

interface CircuitItem {
  key: string; // cle unique locale (permet de mettre le meme exercice plusieurs fois si besoin)
  name: string;
}

type Phase =
  | { type: "work"; exerciseName: string; duration: number; round: number; totalRounds: number; index: number; total: number }
  | { type: "rest"; duration: number; round: number; totalRounds: number; nextExerciseName: string }
  | { type: "roundRest"; duration: number; round: number; totalRounds: number };

// Joue un petit bip via l'API Web Audio (aucun fichier son necessaire)
function beep(freq: number, duration = 180) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + duration / 1000);
    osc.onended = () => ctx.close();
  } catch {
    // navigateur sans Web Audio : tant pis, pas de son
  }
}

function buildPhases(items: CircuitItem[], workSeconds: number, restSeconds: number, rounds: number, roundRestSeconds: number): Phase[] {
  const phases: Phase[] = [];
  for (let round = 1; round <= rounds; round++) {
    items.forEach((item, index) => {
      phases.push({
        type: "work",
        exerciseName: item.name,
        duration: workSeconds,
        round,
        totalRounds: rounds,
        index: index + 1,
        total: items.length,
      });
      const isLastExerciseOfRound = index === items.length - 1;
      if (!isLastExerciseOfRound && restSeconds > 0) {
        phases.push({
          type: "rest",
          duration: restSeconds,
          round,
          totalRounds: rounds,
          nextExerciseName: items[index + 1].name,
        });
      }
    });
    if (round < rounds && roundRestSeconds > 0) {
      phases.push({ type: "roundRest", duration: roundRestSeconds, round, totalRounds: rounds });
    }
  }
  return phases;
}

export default function Chrono() {
  const [catalog, setCatalog] = useState<CatalogExercise[]>([]);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<CircuitItem[]>([]);
  const [customName, setCustomName] = useState("");

  const [workSeconds, setWorkSeconds] = useState(40);
  const [restSeconds, setRestSeconds] = useState(20);
  const [rounds, setRounds] = useState(3);
  const [roundRestSeconds, setRoundRestSeconds] = useState(60);

  const [phases, setPhases] = useState<Phase[] | null>(null);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const intervalRef = useRef<number | null>(null);

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
      // si la creation echoue (ex: hors ligne), on ajoute quand meme localement au circuit
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

  function startCircuit() {
    if (items.length === 0) return;
    const built = buildPhases(items, workSeconds, restSeconds, rounds, roundRestSeconds);
    setPhases(built);
    setPhaseIndex(0);
    setRemaining(built[0].duration);
    setFinished(false);
    setRunning(true);
    beep(880);
  }

  function stopCircuit() {
    setPhases(null);
    setRunning(false);
    setFinished(false);
    if (intervalRef.current) window.clearInterval(intervalRef.current);
  }

  function skipPhase() {
    if (!phases) return;
    if (phaseIndex + 1 >= phases.length) {
      setFinished(true);
      setRunning(false);
      beep(660, 400);
      return;
    }
    setPhaseIndex((i) => i + 1);
    setRemaining(phases[phaseIndex + 1].duration);
    beep(phases[phaseIndex + 1].type === "work" ? 880 : 440);
  }

  useEffect(() => {
    if (!running || !phases) return;
    intervalRef.current = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          // passage a la phase suivante (ou fin du circuit)
          if (phaseIndex + 1 >= phases.length) {
            setFinished(true);
            setRunning(false);
            beep(660, 400);
            return 0;
          }
          setPhaseIndex((i) => i + 1);
          beep(phases[phaseIndex + 1].type === "work" ? 880 : 440);
          return phases[phaseIndex + 1].duration;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, phases, phaseIndex]);

  const currentPhase = phases ? phases[phaseIndex] : null;

  // --- Ecran "circuit en cours" ---
  if (phases && currentPhase) {
    const phaseColor =
      currentPhase.type === "work" ? "text-accent border-accent" : "text-success border-success";

    return (
      <div className="max-w-md mx-auto text-center pt-6">
        {finished ? (
          <>
            <h1 className="font-display text-3xl uppercase tracking-wide mb-4">Circuit termine ! 🎉</h1>
            <p className="text-muted text-sm mb-6">Bien joue, seance complete.</p>
            <button
              onClick={stopCircuit}
              className="bg-accent hover:bg-accentSoft transition-colors text-bg font-semibold rounded-md px-5 py-2"
            >
              Retour
            </button>
          </>
        ) : (
          <>
            <p className="text-muted text-sm mb-1">
              Tour {currentPhase.round} / {currentPhase.totalRounds}
              {currentPhase.type === "work" && ` · Exercice ${currentPhase.index}/${currentPhase.total}`}
            </p>
            <div className={`border-4 rounded-full w-56 h-56 mx-auto flex flex-col items-center justify-center my-6 ${phaseColor}`}>
              <p className="font-display text-6xl">{remaining}</p>
              <p className="text-xs text-muted uppercase tracking-wide">secondes</p>
            </div>
            <h2 className="font-display text-2xl uppercase tracking-wide mb-1">
              {currentPhase.type === "work"
                ? currentPhase.exerciseName
                : currentPhase.type === "rest"
                ? `Repos — ensuite : ${currentPhase.nextExerciseName}`
                : "Repos entre les tours"}
            </h2>

            <div className="flex justify-center gap-3 mt-6">
              <button
                onClick={() => setRunning((r) => !r)}
                className="bg-surface2 hover:bg-border transition-colors border border-border rounded-md px-4 py-2 text-sm"
              >
                {running ? "Pause" : "Reprendre"}
              </button>
              <button
                onClick={skipPhase}
                className="bg-surface2 hover:bg-border transition-colors border border-border rounded-md px-4 py-2 text-sm"
              >
                Passer
              </button>
              <button onClick={stopCircuit} className="text-muted hover:text-accent text-sm px-3 py-2">
                Arreter
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // --- Ecran de construction du circuit ---
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl uppercase tracking-wide mb-1">Chronometre</h1>
      <p className="text-muted text-sm mb-6">
        Construis ta propre seance en circuit training : choisis tes exercices, le temps de travail et de repos,
        le nombre de tours, et lance le chrono.
      </p>

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
            onClick={startCircuit}
            disabled={items.length === 0}
            className="w-full mt-4 bg-accent hover:bg-accentSoft transition-colors text-bg font-semibold rounded-md py-2.5 disabled:opacity-50"
          >
            Lancer le circuit
          </button>
        </div>
      </div>
    </div>
  );
}
