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

interface FavoriteCircuit {
  id: string;
  name: string;
  items: string; // JSON
  workSeconds: number;
  restSeconds: number;
  rounds: number;
  roundRestSeconds: number;
}

export default function Chrono() {
  const [mode, setMode] = useState<"circuit" | "minuteur" | "chronometre">("circuit");

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

  const [favorites, setFavorites] = useState<FavoriteCircuit[]>([]);
  const [savingFavoriteName, setSavingFavoriteName] = useState<string | null>(null);

  useEffect(() => {
    api.get<CatalogExercise[]>("/exercises").then(setCatalog);
    loadFavorites();
  }, []);

  function loadFavorites() {
    api.get<FavoriteCircuit[]>("/favorite-circuits").then(setFavorites);
  }

  function loadFavorite(fav: FavoriteCircuit) {
    const names = JSON.parse(fav.items) as string[];
    setItems(names.map((name) => ({ key: `${name}-${Date.now()}-${Math.random()}`, name })));
    setWorkSeconds(fav.workSeconds);
    setRestSeconds(fav.restSeconds);
    setRounds(fav.rounds);
    setRoundRestSeconds(fav.roundRestSeconds);
  }

  async function saveFavorite() {
    if (!savingFavoriteName?.trim() || items.length === 0) return;
    await api.post("/favorite-circuits", {
      name: savingFavoriteName.trim(),
      items: items.map((i) => i.name),
      workSeconds,
      restSeconds,
      rounds,
      roundRestSeconds,
    });
    setSavingFavoriteName(null);
    loadFavorites();
  }

  async function deleteFavorite(id: string) {
    await api.del(`/favorite-circuits/${id}`);
    loadFavorites();
  }

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
      // même si l'enregistrement echoue (ex: hors ligne), on ne bloque pas l'utilisateur
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
        Construis ta propre séance en circuit training, ou utilise simplement un minuteur ou un chronometre.
      </p>

      <div className="flex gap-1.5 mb-6 flex-wrap">
        <button
          onClick={() => setMode("circuit")}
          className={`px-3 py-1.5 rounded text-sm border ${
            mode === "circuit" ? "bg-accent/20 border-accent text-text" : "bg-surface border-border text-muted"
          }`}
        >
          Circuit training
        </button>
        <button
          onClick={() => setMode("minuteur")}
          className={`px-3 py-1.5 rounded text-sm border ${
            mode === "minuteur" ? "bg-accent/20 border-accent text-text" : "bg-surface border-border text-muted"
          }`}
        >
          Minuteur
        </button>
        <button
          onClick={() => setMode("chronometre")}
          className={`px-3 py-1.5 rounded text-sm border ${
            mode === "chronometre" ? "bg-accent/20 border-accent text-text" : "bg-surface border-border text-muted"
          }`}
        >
          Chronometre
        </button>
      </div>

      {mode === "minuteur" ? (
        <MinuteurTimer />
      ) : mode === "chronometre" ? (
        <ChronometreTimer />
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            {favorites.length > 0 && (
              <div className="mb-5">
                <h2 className="font-display uppercase tracking-wide text-sm mb-2">Mes circuits favoris</h2>
                <div className="space-y-1.5">
                  {favorites.map((fav) => (
                    <div
                      key={fav.id}
                      className="flex items-center justify-between bg-surface border border-border rounded-md px-3 py-2 text-sm"
                    >
                      <button onClick={() => loadFavorite(fav)} className="text-left hover:text-accent">
                        ⭐ {fav.name}
                      </button>
                      <button onClick={() => deleteFavorite(fav.id)} className="text-muted hover:text-accent text-xs">
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
              {items.length === 0 && <p className="text-muted text-sm italic">Aucun exercice ajouté pour l'instant.</p>}
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
            <h2 className="font-display uppercase tracking-wide text-sm mb-2">2. Réglages du circuit</h2>
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

            {savingFavoriteName !== null ? (
              <div className="flex gap-2 mt-2">
                <input
                  value={savingFavoriteName}
                  onChange={(e) => setSavingFavoriteName(e.target.value)}
                  placeholder="Nom du circuit favori..."
                  className="flex-1 bg-surface2 border border-border rounded-md px-2 py-1.5 text-sm"
                />
                <button onClick={saveFavorite} className="bg-surface2 hover:bg-border border border-border rounded-md px-3 py-1.5 text-sm">
                  OK
                </button>
                <button onClick={() => setSavingFavoriteName(null)} className="text-muted text-sm px-2">
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => setSavingFavoriteName("")}
                disabled={items.length === 0}
                className="w-full mt-2 text-sm text-accent hover:text-accentSoft disabled:opacity-40"
              >
                ⭐ Sauvegarder ce circuit en favori
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function beepShort() {
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
}

// Minuteur : compte a rebours simple depuis une durée choisie, avec bip a la fin.
function MinuteurTimer() {
  const [inputMinutes, setInputMinutes] = useState(1);
  const [inputSeconds, setInputSeconds] = useState(0);
  const [remaining, setRemaining] = useState(60);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<number | null>(null);

  function applySettings() {
    setRemaining(inputMinutes * 60 + inputSeconds);
    setRunning(false);
  }

  useEffect(() => {
    if (!running) return;
    intervalRef.current = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false);
          beepShort();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [running]);

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
          disabled={remaining === 0}
          className="bg-accent hover:bg-accentSoft transition-colors text-bg font-semibold rounded-md px-5 py-2 disabled:opacity-50"
        >
          {running ? "Pause" : "Demarrer"}
        </button>
        <button
          onClick={applySettings}
          className="bg-surface2 hover:bg-border transition-colors border border-border rounded-md px-4 py-2 text-sm"
        >
          Réinitialiser
        </button>
      </div>

      <div className="bg-surface border border-border rounded-lg p-4">
        <p className="text-xs text-muted mb-2">Regle la durée du compte a rebours.</p>
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

// Chronometre : compte en avant depuis 0, comme un vrai chronometre de sport.
function ChronometreTimer() {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [running]);

  const mm = Math.floor(elapsed / 60);
  const ss = elapsed % 60;

  return (
    <div className="max-w-sm mx-auto text-center">
      <div className="border-4 border-accent rounded-full w-56 h-56 mx-auto flex flex-col items-center justify-center my-6">
        <p className="font-display text-6xl">
          {mm}:{ss.toString().padStart(2, "0")}
        </p>
      </div>

      <div className="flex justify-center gap-3">
        <button
          onClick={() => setRunning((r) => !r)}
          className="bg-accent hover:bg-accentSoft transition-colors text-bg font-semibold rounded-md px-5 py-2"
        >
          {running ? "Pause" : elapsed === 0 ? "Demarrer" : "Reprendre"}
        </button>
        <button
          onClick={() => {
            setRunning(false);
            setElapsed(0);
          }}
          className="bg-surface2 hover:bg-border transition-colors border border-border rounded-md px-4 py-2 text-sm"
        >
          Réinitialiser
        </button>
      </div>
    </div>
  );
}
