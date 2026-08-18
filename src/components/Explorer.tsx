"use client";

import { useState } from "react";
import { LandscapeView } from "@/views/LandscapeView";
import { DataFlowView } from "@/views/DataFlowView";
import { SequenceView } from "@/views/SequenceView";
import { DataStoreView } from "@/views/DataStoreView";
import { MigrationView } from "@/views/MigrationView";
import { site, type ViewId } from "@/config/site";
import type { Phase } from "@/data/model";
import { ModelProvider } from "@/lib/model/ModelContext";
import { ArchitectureChat } from "./ArchitectureChat";
import { DetailPanel } from "./DetailPanel";
import { HistoryPanel } from "./HistoryPanel";
import { SearchBar } from "./SearchBar";
import { Legend } from "./Legend";
import { PhaseFilter } from "./PhaseFilter";

const views: { id: ViewId; label: string }[] = [
  { id: "landscape", label: "System Landscape" },
  { id: "flows", label: "Data Flows" },
  { id: "sequences", label: "Sequence Diagrams" },
  { id: "stores", label: "Data Stores" },
  { id: "migrations", label: "Migration Map" },
  { id: "history", label: "History" },
];

/** Views that render the node-graph Legend overlay. */
const viewsWithLegend: ViewId[] = ["landscape", "flows", "stores"];

/**
 * Views the Current/Target filter applies to. The Migration Map is excluded on purpose:
 * every migration is a current → target pairing, so filtering it to one side would empty
 * it of the very thing it exists to show.
 */
const viewsWithPhaseFilter: ViewId[] = [
  "landscape",
  "flows",
  "sequences",
  "stores",
];

export function Explorer() {
  const [view, setView] = useState<ViewId>(site.defaultView);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("both");

  return (
    <ModelProvider>
      <div className="flex h-full flex-col">
        <header className="flex items-center gap-6 border-b border-slate-800 px-5 py-3">
          <div>
            <h1 className="text-sm font-semibold text-slate-100">
              {site.headerTitle}
            </h1>
            <p className="text-[11px] text-slate-500">{site.headerSubtitle}</p>
          </div>
          <nav className="flex gap-1">
            {views.map((candidate) => (
              <button
                key={candidate.id}
                onClick={() => setView(candidate.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  view === candidate.id
                    ? "bg-sky-500/15 text-sky-300"
                    : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-200"
                }`}
              >
                {candidate.label}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {viewsWithPhaseFilter.includes(view) && (
              <PhaseFilter phase={phase} onChange={setPhase} />
            )}
            <SearchBar onSelect={setSelectedId} phase={phase} />
          </div>
        </header>
        <div className="flex min-h-0 flex-1">
          <main className="relative min-w-0 flex-1">
            {view === "landscape" && (
              <LandscapeView
                selectedId={selectedId}
                onSelect={setSelectedId}
                phase={phase}
              />
            )}
            {view === "flows" && (
              <DataFlowView
                selectedId={selectedId}
                onSelect={setSelectedId}
                phase={phase}
              />
            )}
            {view === "sequences" && (
              <SequenceView
                selectedId={selectedId}
                onSelect={setSelectedId}
                phase={phase}
              />
            )}
            {view === "stores" && (
              <DataStoreView
                selectedId={selectedId}
                onSelect={setSelectedId}
                phase={phase}
              />
            )}
            {view === "migrations" && <MigrationView onSelect={setSelectedId} />}
            {view === "history" && <HistoryPanel />}
            {viewsWithLegend.includes(view) && <Legend />}
          </main>
          {selectedId && (
            <DetailPanel
              nodeId={selectedId}
              onSelect={setSelectedId}
              onClose={() => setSelectedId(null)}
            />
          )}
        </div>
      </div>
      <ArchitectureChat />
    </ModelProvider>
  );
}
