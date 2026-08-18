"use client";

import type { Phase } from "@/data/model";

/**
 * The global Current / Both / Target control.
 *
 * Phase is derived, not authored — see `nodePhase`/`flowPhase`/`sequencePhase` in
 * `src/data/model.ts`. "Both" is the default and matches everything, so the unfiltered
 * view is unchanged from before this control existed.
 */
const OPTIONS: { id: Phase; label: string; title: string }[] = [
  {
    id: "current",
    label: "Current",
    title: "Today's state only — hides everything planned for the target architecture",
  },
  {
    id: "both",
    label: "Both",
    title: "Current and target together, with target-state flows dashed",
  },
  {
    id: "target",
    label: "Target",
    title: "The target state only — hides systems retiring along the way",
  },
];

interface PhaseFilterProps {
  phase: Phase;
  onChange: (phase: Phase) => void;
}

export function PhaseFilter({ phase, onChange }: PhaseFilterProps) {
  return (
    <div
      role="group"
      aria-label="Filter by migration phase"
      className="flex items-center gap-0.5 rounded-md border border-slate-700 bg-[#111a2b] p-0.5"
    >
      {OPTIONS.map((option) => {
        const active = option.id === phase;
        return (
          <button
            key={option.id}
            onClick={() => onChange(option.id)}
            title={option.title}
            aria-pressed={active}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              active
                ? "bg-sky-500/20 text-sky-300"
                : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-200"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
