import { useState } from "react";
import { api } from "../api/client";

const REACTIONS = [
  { key: "OVATION", label: "Ovation", emoji: "🙌" },
  { key: "RESPECT", label: "Respect", emoji: "🫡" },
  { key: "HAKA", label: "Haka", emoji: "💥" },
  { key: "OLA", label: "Ola", emoji: "🌊" },
  { key: "HYMNE", label: "Hymne", emoji: "🎶" },
  { key: "CLAPPING", label: "Clapping", emoji: "👏" },
  { key: "TIFO", label: "Tifo", emoji: "🎨" },
  { key: "TAMBOURINAGE", label: "Tambourinage", emoji: "🥁" },
];

export interface ReactionSummary {
  type: string;
  count: number;
  reactedByMe: boolean;
}

interface Props {
  targetType: "exercise" | "circuit";
  targetId: string;
  reactions: ReactionSummary[];
  onChange: () => void;
}

export default function ReactionPicker({ targetType, targetId, reactions, onChange }: Props) {
  const [open, setOpen] = useState(false);

  async function toggle(type: string) {
    setOpen(false);
    await api.post("/reactions", { targetType, targetId, type });
    onChange();
  }

  return (
    <div className="relative inline-block">
      <div className="flex items-center gap-1 flex-wrap">
        {reactions.map((r) => {
          const def = REACTIONS.find((d) => d.key === r.type);
          if (!def) return null;
          return (
            <button
              key={r.type}
              onClick={() => toggle(r.type)}
              title={def.label}
              className={`text-xs rounded-full px-2 py-0.5 border ${
                r.reactedByMe ? "bg-accent/20 border-accent" : "bg-surface2 border-border"
              }`}
            >
              {def.emoji} {r.count}
            </button>
          );
        })}
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-xs rounded-full px-2 py-0.5 border border-dashed border-border text-muted hover:text-accent"
        >
          + reagir
        </button>
      </div>

      {open && (
        <div className="absolute z-10 mt-1 bg-surface border border-border rounded-lg p-2 grid grid-cols-4 gap-1 shadow-lg">
          {REACTIONS.map((r) => (
            <button
              key={r.key}
              onClick={() => toggle(r.key)}
              title={r.label}
              className="text-xl hover:bg-surface2 rounded p-1"
            >
              {r.emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
