import type {
  Domain,
  FlowKind,
  MigrationStatus,
  SystemStatus,
  Tier,
} from "@/config/taxonomy";

// The categorical vocabularies (tiers, statuses, flow kinds, domains, migration statuses)
// are defined once in src/config/taxonomy.ts and re-exported here so existing
// `@/data/types` imports keep resolving. Edit the vocabulary in taxonomy.ts, not here.
export type { Domain, FlowKind, MigrationStatus, SystemStatus, Tier };

/**
 * Which side of a legacy-to-modern cutover something belongs to, for the global
 * Current/Target filter.
 *
 * `both` means "exists before and after" — retained systems, third parties, and the
 * flows between them. It is the default for anything not explicitly one-sided.
 *
 * A system's phase is DERIVED from its `status` (see `nodePhase()` in `model.ts`), so
 * there is nothing to set on `SystemDef`. Data stores and externals have no status, and
 * their phase can't always be derived from their flows either (a shared piece of
 * infrastructure might be tagged on target-only flows despite running today), so those
 * two kinds carry an explicit optional `phase`.
 */
export type Phase = "current" | "target" | "both";

export interface SystemDef {
  kind: "system";
  id: string;
  name: string;
  tier: Tier;
  status: SystemStatus;
  description: string;
  stack: string[];
  runtime: string;
  repoPath?: string;
  url?: string;
  notes?: string[];
}

export interface DataStoreDef {
  kind: "datastore";
  id: string;
  name: string;
  technology: string;
  description: string;
  contents: string[];
  /** Omit for stores that exist on both sides of the cutover. */
  phase?: Phase;
}

export interface ExternalDef {
  kind: "external";
  id: string;
  name: string;
  category: string;
  description: string;
  /** Omit for third parties retained through the cutover (the usual case). */
  phase?: Phase;
}

export type ArchNodeDef = SystemDef | DataStoreDef | ExternalDef;

export interface FlowDef {
  id: string;
  source: string;
  target: string;
  kind: FlowKind;
  domains: Domain[];
  label: string;
  description?: string;
  planned?: boolean;
  /**
   * Position in a sequenced trace within one domain. The edge renders animated and
   * numbered when that domain is selected in the Data Flows view. Steps that happen in
   * parallel may share a number.
   */
  step?: number;
  /**
   * Which domain's trace a `step` belongs to. Defaults to `domains[0]`.
   *
   * Without this, a stepped flow tagged with several domains would render its number in
   * every one of them — e.g. a step tagged both `orders` and `fulfillment` would show a
   * stray number on the Fulfillment chip too. Set it when a stepped flow is multi-domain.
   */
  stepDomain?: Domain;
}

export interface MigrationDef {
  id: string;
  title: string;
  from: string[]; // legacy node ids
  to: string[]; // modern node ids
  status: MigrationStatus;
  summary: string;
  deadline?: string;
}

/**
 * One message in a sequence diagram — either a call (solid arrow) or a return
 * (dashed arrow, `response: true`). `from`/`to` are participant ids: either a real
 * architecture node id or a diagram-only actor id (see `actors` in `sequences.ts`).
 */
export interface SequenceMessage {
  from: string;
  to: string;
  kind: FlowKind;
  label: string;
  /** Renders as a dashed return arrow, closing the caller's activation. */
  response?: boolean;
  /** Optional annotation shown beneath the message (e.g. a branch/decline note). */
  note?: string;
  /** Dashed "planned" styling, mirroring `FlowDef.planned`. */
  planned?: boolean;
}

/**
 * A named order/payment scenario rendered as a sequence diagram. `participants` is the
 * left-to-right lifeline order; each id is an architecture node id, except diagram-only
 * actors declared in `sequences.ts`. There is no runtime validation — an id in `from`/
 * `to`/`participants` that resolves to neither a node nor an actor silently misrenders.
 */
export interface SequenceDef {
  id: string;
  title: string;
  /** Colors the diagram and groups the scenario selector (e.g. orders vs payments). */
  domain: Domain;
  summary: string;
  participants: string[];
  messages: SequenceMessage[];
}
