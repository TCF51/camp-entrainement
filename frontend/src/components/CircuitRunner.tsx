import { useEffect, useRef, useState } from "react";

export interface CircuitRunnerItem {
  name: string;
}

interface Props {
  items: CircuitRunnerItem[];
  workSeconds: number;
  restSeconds: number;
  rounds: number;
  roundRestSeconds: number;
  onComplete: (totalDurationSeconds: number) => void;
  onCancel: () => void;
}

type Phase =
  | { type: "work"; exerciseName: string; duration: number; round: number; totalRounds: number; index: number; total: number }
  | { type: "rest"; duration: number; round: number; totalRounds: number; nextExerciseName: string }
  | { type: "roundRest"; duration: number; round: number; totalRounds: number };

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

function buildPhases(
  items: CircuitRunnerItem[],
  workSeconds: number,
  restSeconds: number,
  rounds: number,
  roundRestSeconds: number
): Phase[] {
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

// Composant plein ecran qui deroule un circuit (travail/repos/tours) avec bips sonores aux transitions.
export default function CircuitRunner({ items, workSeconds, restSeconds, rounds, roundRestSeconds, onComplete, onCancel }: Props) {
  const [phases] = useState<Phase[]>(() => buildPhases(items, workSeconds, restSeconds, rounds, roundRestSeconds));
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [remaining, setRemaining] = useState(phases[0]?.duration ?? 0);
  const [running, setRunning] = useState(true);
  const [finished, setFinished] = useState(false);
  const elapsedRef = useRef(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    beep(880);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function skipPhase() {
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
    if (!running) return;
    intervalRef.current = window.setInterval(() => {
      elapsedRef.current += 1;
      setRemaining((r) => {
        if (r <= 1) {
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
  }, [running, phaseIndex]);

  const currentPhase = phases[phaseIndex];

  if (finished) {
    return (
      <div className="max-w-md mx-auto text-center pt-6">
        <h2 className="font-display text-3xl uppercase tracking-wide mb-4">Circuit termine ! 🎉</h2>
        <p className="text-muted text-sm mb-6">Bien joue, seance complete.</p>
        <button
          onClick={() => onComplete(elapsedRef.current)}
          className="bg-accent hover:bg-accentSoft transition-colors text-bg font-semibold rounded-md px-5 py-2"
        >
          Valider et continuer
        </button>
      </div>
    );
  }

  if (!currentPhase) return null;

  const phaseColor = currentPhase.type === "work" ? "text-accent border-accent" : "text-success border-success";

  return (
    <div className="max-w-md mx-auto text-center pt-6">
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
        <button onClick={onCancel} className="text-muted hover:text-accent text-sm px-3 py-2">
          Arreter
        </button>
      </div>
    </div>
  );
}
