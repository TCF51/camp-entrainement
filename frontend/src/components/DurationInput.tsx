import { splitSeconds, mmssToSeconds } from "../lib/duration";

interface Props {
  totalSeconds: number;
  onChange: (totalSeconds: number) => void;
  className?: string;
}

// Champ de saisie d'une duree au format min:sec (plus naturel que des secondes brutes
// pour des exercices comme le gainage ou la chaise contre le mur).
export default function DurationInput({ totalSeconds, onChange, className }: Props) {
  const { minutes, seconds } = splitSeconds(totalSeconds);

  return (
    <div className={`flex items-center gap-1 ${className ?? ""}`}>
      <input
        type="number"
        min={0}
        value={minutes}
        onChange={(e) => onChange(mmssToSeconds(Number(e.target.value), seconds))}
        className="w-14 bg-surface border border-border rounded-md px-2 py-1.5 text-sm text-center"
        aria-label="Minutes"
      />
      <span className="text-muted text-sm">min</span>
      <input
        type="number"
        min={0}
        max={59}
        value={seconds}
        onChange={(e) => onChange(mmssToSeconds(minutes, Number(e.target.value)))}
        className="w-14 bg-surface border border-border rounded-md px-2 py-1.5 text-sm text-center"
        aria-label="Secondes"
      />
      <span className="text-muted text-sm">sec</span>
    </div>
  );
}
