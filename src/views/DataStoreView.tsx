"use client";

import { useMemo, useState } from "react";
import { matchesPhase, type Phase } from "@/data/model";
import { useModel } from "@/lib/model/ModelContext";
import { FlowGraph } from "@/graph/FlowGraph";
import { dagreLayout } from "@/graph/layout";
import { nodeVisual } from "@/lib/theme";

interface DataStoreViewProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  phase: Phase;
}

export function DataStoreView({
  selectedId,
  onSelect,
  phase,
}: DataStoreViewProps) {
  const { datastores, flows, nodeById, nodePhase, flowPhase } = useModel();
  const [storeId, setStoreId] = useState<string>(datastores[0]?.id ?? "");

  const visibleStores = useMemo(
    () =>
      datastores.filter((store) => matchesPhase(nodePhase(store), phase)),
    [phase, datastores, nodePhase],
  );
  // Derive rather than sync state: if the phase filter hides the selected store, fall
  // back to the first visible one instead of rendering an empty canvas.
  const store =
    visibleStores.find((candidate) => candidate.id === storeId) ??
    visibleStores[0];
  const activeId = store?.id ?? "";

  const { positions, storeFlows } = useMemo(() => {
    const storeFlows = flows.filter(
      (flow) =>
        (flow.source === activeId || flow.target === activeId) &&
        matchesPhase(flowPhase(flow), phase),
    );
    const ids = new Set<string>([activeId]);
    for (const flow of storeFlows) {
      ids.add(flow.source);
      ids.add(flow.target);
    }
    // Drop neighbours that belong to the other phase — the store itself always stays so
    // its fact sheet still renders even when every one of its flows is filtered out.
    const visibleIds = [...ids].filter((id) => {
      if (id === activeId) return true;
      const node = nodeById.get(id);
      return node ? matchesPhase(nodePhase(node), phase) : false;
    });
    return {
      positions: dagreLayout(visibleIds, storeFlows),
      storeFlows,
    };
  }, [activeId, phase, flows, nodeById, nodePhase, flowPhase]);

  if (!store) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-300">
        No data stores in the {phase === "current" ? "current" : "target"} state.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-4 py-2.5">
        {visibleStores.map((candidate) => {
          const active = candidate.id === activeId;
          const accent = nodeVisual(candidate).accent;
          return (
            <button
              key={candidate.id}
              onClick={() => setStoreId(candidate.id)}
              className="rounded-full px-3 py-1 text-[13px] font-medium transition-colors"
              style={{
                background: active ? `${accent}26` : "#151d2c",
                color: active ? accent : "#cbd5e1",
                border: `1px solid ${active ? accent : "#4a5a75"}`,
              }}
            >
              {candidate.name}
            </button>
          );
        })}
      </div>
      <div className="relative min-h-0 flex-1">
        <FlowGraph
          key={`${activeId}-${phase}`}
          positions={positions}
          flows={storeFlows}
          selectedId={selectedId}
          onSelect={onSelect}
        />
        <div className="pointer-events-none absolute bottom-4 left-4 max-w-md rounded-lg border border-slate-700 bg-[#0e1626]/95 p-4">
          <div className="text-[15px] font-semibold text-slate-100">{store.name}</div>
          <div className="text-xs text-slate-400">{store.technology}</div>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-300">
            {store.description}
          </p>
          <ul className="mt-2 space-y-1">
            {store.contents.map((item) => (
              <li key={item} className="flex gap-1.5 text-[13px] text-slate-300">
                <span className="text-cyan-400">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
