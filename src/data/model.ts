import { systems } from "./systems";
import { datastores } from "./datastores";
import { externals } from "./externals";
import { flows } from "./flows";
import { migrations } from "./migrations";
import { sequences, actors } from "./sequences";
import type {
  ArchNodeDef,
  DataStoreDef,
  Domain,
  ExternalDef,
  FlowDef,
  MigrationDef,
  Phase,
  SequenceDef,
  SystemDef,
} from "./types";

export type { Phase };

/** Does something belong in the given filter view? `both` matches on either side. */
export function matchesPhase(itemPhase: Phase, filter: Phase): boolean {
  return filter === "both" || itemPhase === "both" || itemPhase === filter;
}

export interface Model {
  systems: SystemDef[];
  datastores: DataStoreDef[];
  externals: ExternalDef[];
  flows: FlowDef[];
  migrations: MigrationDef[];
  sequences: SequenceDef[];
  actors: Record<string, string>;
  allNodes: ArchNodeDef[];
  nodeById: Map<string, ArchNodeDef>;
  sequenceById: Map<string, SequenceDef>;
  nodePhase(node: ArchNodeDef): Phase;
  flowPhase(flow: FlowDef): Phase;
  sequencePhase(sequence: SequenceDef): Phase;
  flowsForNode(nodeId: string): { outgoing: FlowDef[]; incoming: FlowDef[] };
  flowsForDomain(domain: Domain): FlowDef[];
  nodeIdsForFlows(subset: FlowDef[]): string[];
  isArchNode(id: string): boolean;
  participantLabel(id: string): string;
}

/**
 * Builds the derived lookups/selectors from a set of raw model arrays. Pure and
 * side-effect-free so it can be called again with a draft (e.g. chat-proposed) dataset
 * for live preview, not just once at module load — see `ModelContext`.
 */
export function buildModel(
  systems: SystemDef[],
  datastores: DataStoreDef[],
  externals: ExternalDef[],
  flows: FlowDef[],
  migrations: MigrationDef[],
  sequences: SequenceDef[],
  actors: Record<string, string>,
): Model {
  const allNodes: ArchNodeDef[] = [...systems, ...datastores, ...externals];

  const nodeById = new Map<string, ArchNodeDef>(
    allNodes.map((node) => [node.id, node]),
  );

  const sequenceById = new Map<string, SequenceDef>(
    sequences.map((sequence) => [sequence.id, sequence]),
  );

  // ── Cutover phase ─────────────────────────────────────────────────────────────
  // Everything below is DERIVED — there is no phase bookkeeping to keep in sync when
  // the model changes. A system's phase falls out of its `status`, a flow's out of
  // `planned` plus its endpoints. Only data stores and externals can override, via
  // their optional `phase` field (see the note in types.ts for why).

  /** Which side of the cutover a node lives on. */
  function nodePhase(node: ArchNodeDef): Phase {
    if (node.kind !== "system") return node.phase ?? "both";
    switch (node.status) {
      case "migrating-out":
      case "deprecated":
        return "current";
      case "planned":
        return "target";
      // `production` and `migrating-in` both survive the cutover unchanged or land in
      // their new place, so they show on both sides of the toggle.
      default:
        return "both";
    }
  }

  /**
   * Which side of the cutover a flow lives on.
   *
   * `planned` means "doesn't exist yet", so it is target-only. An unplanned flow exists
   * today, and survives the cutover unless one of its endpoints doesn't — which is why
   * this reads the endpoints rather than trusting `planned` alone. (An unplanned flow
   * into a target-only node is a modelling error; it resolves to `target` rather than
   * quietly showing up in the current-state view.)
   */
  function flowPhase(flow: FlowDef): Phase {
    if (flow.planned) return "target";
    const ends = [flow.source, flow.target]
      .map((id) => nodeById.get(id))
      .filter((node): node is ArchNodeDef => node !== undefined)
      .map(nodePhase);
    if (ends.includes("target")) return "target";
    if (ends.includes("current")) return "current";
    return "both";
  }

  /** Which side of the cutover a sequence scenario describes. */
  function sequencePhase(sequence: SequenceDef): Phase {
    if (sequence.messages.some((message) => message.planned)) return "target";
    const ends = sequence.participants
      .map((id) => nodeById.get(id))
      .filter((node): node is ArchNodeDef => node !== undefined)
      .map(nodePhase);
    if (ends.includes("target")) return "target";
    if (ends.includes("current")) return "current";
    return "both";
  }

  function flowsForNode(nodeId: string): {
    outgoing: FlowDef[];
    incoming: FlowDef[];
  } {
    return {
      outgoing: flows.filter((flow) => flow.source === nodeId),
      incoming: flows.filter((flow) => flow.target === nodeId),
    };
  }

  function flowsForDomain(domain: Domain): FlowDef[] {
    return flows.filter((flow) => flow.domains.includes(domain));
  }

  /** Node ids referenced by a set of flows, in stable order. */
  function nodeIdsForFlows(subset: FlowDef[]): string[] {
    const ids = new Set<string>();
    for (const flow of subset) {
      ids.add(flow.source);
      ids.add(flow.target);
    }
    return allNodes.filter((node) => ids.has(node.id)).map((node) => node.id);
  }

  /** True when a participant id is a real architecture node (i.e. has a fact sheet). */
  function isArchNode(id: string): boolean {
    return nodeById.has(id);
  }

  /** Display name for a sequence participant — a node name, an actor label, or the raw id. */
  function participantLabel(id: string): string {
    return nodeById.get(id)?.name ?? actors[id] ?? id;
  }

  return {
    systems,
    datastores,
    externals,
    flows,
    migrations,
    sequences,
    actors,
    allNodes,
    nodeById,
    sequenceById,
    nodePhase,
    flowPhase,
    sequencePhase,
    flowsForNode,
    flowsForDomain,
    nodeIdsForFlows,
    isArchNode,
    participantLabel,
  };
}

/** The real, static architecture model — the only model before the chat editor exists. */
export const staticModel = buildModel(
  systems,
  datastores,
  externals,
  flows,
  migrations,
  sequences,
  actors,
);
