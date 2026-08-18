"use client";

import { useMemo, useState } from "react";
import { matchesPhase, type Phase } from "@/data/model";
import { useModel } from "@/lib/model/ModelContext";
import { domainColors } from "@/lib/theme";
import { SequenceDiagram } from "@/graph/SequenceDiagram";

interface SequenceViewProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  phase: Phase;
}

export function SequenceView({
  selectedId,
  onSelect,
  phase,
}: SequenceViewProps) {
  const { sequences, sequencePhase } = useModel();
  const [sequenceId, setSequenceId] = useState<string>(sequences[0]?.id ?? "");

  const visible = useMemo(
    () =>
      sequences.filter((seq) => matchesPhase(sequencePhase(seq), phase)),
    [phase, sequences, sequencePhase],
  );
  // Derive rather than sync state, so a filter that hides the current selection falls
  // back cleanly instead of blanking the canvas.
  const active = visible.find((seq) => seq.id === sequenceId) ?? visible[0];

  if (!active) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-300">
        No sequences in the {phase} state to show.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-4 py-2.5">
        {visible.map((seq) => {
          const isActive = seq.id === active.id;
          const color = domainColors[seq.domain];
          return (
            <button
              key={seq.id}
              onClick={() => setSequenceId(seq.id)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium transition-colors"
              style={{
                background: isActive ? `${color}26` : "#151d2c",
                color: isActive ? color : "#cbd5e1",
                border: `1px solid ${isActive ? color : "#4a5a75"}`,
              }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: color }}
              />
              {seq.title}
            </button>
          );
        })}
        <div className="ml-auto hidden items-center gap-3 text-xs text-slate-400 lg:flex">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-px w-4 bg-slate-400" />
            Call
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-px w-4 border-t border-dashed border-slate-400" />
            Response
          </span>
          <span>Click a participant for details</span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <p className="max-w-3xl px-6 pt-5 text-sm text-slate-300">{active.summary}</p>
        <div className="px-3 pb-8 pt-2">
          <SequenceDiagram
            sequence={active}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        </div>
      </div>
    </div>
  );
}
