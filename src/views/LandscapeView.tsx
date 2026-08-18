"use client";

import { useMemo } from "react";
import { matchesPhase, type Phase } from "@/data/model";
import type { DataStoreDef, ExternalDef, SystemDef } from "@/data/types";
import { useModel } from "@/lib/model/ModelContext";
import { lanes, type LaneSpec } from "@/config/landscape";
import { FlowGraph, type LaneLabel } from "@/graph/FlowGraph";
import { NODE_HEIGHT, NODE_WIDTH, type Point } from "@/graph/layout";

/** Every id placed by an explicit `{ ids }` lane — subtracted from `{ kind }` lanes. */
const claimedIds = new Set(lanes.flatMap((lane) => ("ids" in lane ? lane.ids : [])));

/**
 * Resolve a lane spec to its ordered list of node ids (see src/config/landscape.ts).
 *
 * A `{ kind }` lane means "every node of this kind NOT already claimed by an explicit
 * `{ ids }` lane", so it doubles as a catch-all: split a kind across custom lanes for
 * legibility and a node added later still lands somewhere instead of silently
 * disappearing from this view.
 */
function laneIds(
  lane: LaneSpec,
  systems: SystemDef[],
  datastores: DataStoreDef[],
  externals: ExternalDef[],
): string[] {
  if ("ids" in lane) return lane.ids;
  if ("tier" in lane) {
    return systems.filter((system) => system.tier === lane.tier).map((s) => s.id);
  }
  const source = lane.kind === "datastore" ? datastores : externals;
  return source.filter((node) => !claimedIds.has(node.id)).map((node) => node.id);
}

const COLUMN_GAP = 190;
const ROW_GAP = 34;
const HEADER_OFFSET = 56;

interface LandscapeViewProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  phase: Phase;
}

export function LandscapeView({
  selectedId,
  onSelect,
  phase,
}: LandscapeViewProps) {
  const { systems, datastores, externals, flows, nodeById, nodePhase, flowPhase } =
    useModel();

  const { positions, laneLabels, visibleFlows } = useMemo(() => {
    const positions = new Map<string, Point>();
    const laneLabels: LaneLabel[] = [];
    // Empty lanes are skipped entirely rather than drawn as a labelled blank column —
    // the `{ kind }` catch-alls are usually empty, and a headed but empty column reads
    // as missing data. `columnIndex` therefore tracks laid-out lanes, not lane index.
    // Filtering by phase reuses this: a lane emptied by the filter collapses too, so
    // the target view drops a lane rather than leaving a gap.
    let columnIndex = 0;
    lanes.forEach((lane) => {
      const ids = laneIds(lane, systems, datastores, externals).filter((id) => {
        const node = nodeById.get(id);
        return node ? matchesPhase(nodePhase(node), phase) : false;
      });
      if (ids.length === 0) return;
      const x = columnIndex * (NODE_WIDTH + COLUMN_GAP);
      columnIndex += 1;
      laneLabels.push({ id: lane.title, text: lane.title, x, y: 0 });
      ids.forEach((id, rowIndex) => {
        positions.set(id, {
          x,
          y: HEADER_OFFSET + rowIndex * (NODE_HEIGHT + ROW_GAP),
        });
      });
    });
    // FlowGraph already drops edges whose endpoints aren't positioned; this additionally
    // removes edges whose endpoints both survive but which belong to the other phase.
    const visibleFlows = flows.filter((flow) =>
      matchesPhase(flowPhase(flow), phase),
    );
    return { positions, laneLabels, visibleFlows };
  }, [phase, systems, datastores, externals, flows, nodeById, nodePhase, flowPhase]);

  return (
    <FlowGraph
      key={phase}
      positions={positions}
      flows={visibleFlows}
      selectedId={selectedId}
      onSelect={onSelect}
      showLabels={false}
      laneLabels={laneLabels}
    />
  );
}
