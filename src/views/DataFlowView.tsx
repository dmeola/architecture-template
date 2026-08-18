"use client";

import { useMemo, useState } from "react";
import type { Domain } from "@/data/types";
import { matchesPhase, type Phase } from "@/data/model";
import { useModel } from "@/lib/model/ModelContext";
import { domainColors, domainLabels, domainOrder } from "@/lib/theme";
import { site } from "@/config/site";
import { FlowGraph } from "@/graph/FlowGraph";
import { dagreLayout } from "@/graph/layout";

interface DataFlowViewProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  phase: Phase;
}

export function DataFlowView({
  selectedId,
  onSelect,
  phase,
}: DataFlowViewProps) {
  const { flowsForDomain, flowPhase, nodeIdsForFlows } = useModel();
  const [domain, setDomain] = useState<Domain>(site.defaultDomain);

  const { positions, domainFlows, stepsShown } = useMemo(() => {
    const all = flowsForDomain(domain);
    const domainFlows = all.filter((flow) =>
      matchesPhase(flowPhase(flow), phase),
    );
    const nodeIds = nodeIdsForFlows(domainFlows);
    // Only number the trace when the phase filter hasn't cut any of it away — a partial
    // trace ("1." then "4." with nothing between) reads as broken.
    const steppedTotal = all.filter((flow) => flow.step !== undefined).length;
    const steppedShown = domainFlows.filter(
      (flow) => flow.step !== undefined,
    ).length;
    return {
      positions: dagreLayout(nodeIds, domainFlows),
      domainFlows,
      stepsShown: steppedShown > 0 && steppedShown === steppedTotal,
    };
  }, [domain, phase, flowsForDomain, flowPhase, nodeIdsForFlows]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-4 py-2.5">
        {domainOrder.map((candidate) => {
          const active = candidate === domain;
          return (
            <button
              key={candidate}
              onClick={() => setDomain(candidate)}
              className="rounded-full px-3 py-1 text-[13px] font-medium transition-colors"
              style={{
                background: active ? `${domainColors[candidate]}26` : "#151d2c",
                color: active ? domainColors[candidate] : "#cbd5e1",
                border: `1px solid ${active ? domainColors[candidate] : "#4a5a75"}`,
              }}
            >
              {domainLabels[candidate]}
            </button>
          );
        })}
        {stepsShown && (
          <span className="ml-auto hidden text-xs text-slate-400 sm:block">
            Numbered edges trace this domain&rsquo;s sequence
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1">
        {domainFlows.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-300">
            No {domainLabels[domain].toLowerCase()} flows in the{" "}
            {phase === "current" ? "current" : "target"} state.
          </div>
        ) : (
          <FlowGraph
            key={`${domain}-${phase}`}
            positions={positions}
            flows={domainFlows}
            selectedId={selectedId}
            onSelect={onSelect}
            traceDomain={domain}
            showSteps={stepsShown}
          />
        )}
      </div>
    </div>
  );
}
