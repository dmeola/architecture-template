import type { Operation } from "./ops";

export type EntityKind =
  | "system"
  | "dataStore"
  | "external"
  | "flow"
  | "migration"
  | "sequence";

/** Where each entity kind's array lives in `src/data/`. */
export const FILE_FOR_KIND: Record<EntityKind, { path: string; arrayName: string }> = {
  system: { path: "src/data/systems.ts", arrayName: "systems" },
  dataStore: { path: "src/data/datastores.ts", arrayName: "datastores" },
  external: { path: "src/data/externals.ts", arrayName: "externals" },
  flow: { path: "src/data/flows.ts", arrayName: "flows" },
  migration: { path: "src/data/migrations.ts", arrayName: "migrations" },
  sequence: { path: "src/data/sequences.ts", arrayName: "sequences" },
};

/** Field order for each entity kind, matching the declaration order in `src/data/types.ts` —
 * keeps AI-authored entries formatted like the hand-written ones around them. */
export const FIELD_ORDER: Record<EntityKind | "sequenceMessage", string[]> = {
  system: [
    "kind",
    "id",
    "name",
    "tier",
    "status",
    "description",
    "stack",
    "runtime",
    "repoPath",
    "url",
    "notes",
  ],
  dataStore: ["kind", "id", "name", "technology", "description", "contents", "phase"],
  external: ["kind", "id", "name", "category", "description", "phase"],
  flow: [
    "id",
    "source",
    "target",
    "kind",
    "domains",
    "label",
    "description",
    "planned",
    "step",
    "stepDomain",
  ],
  migration: ["id", "title", "from", "to", "status", "summary", "deadline"],
  sequence: ["id", "title", "domain", "summary", "participants", "messages"],
  sequenceMessage: ["from", "to", "kind", "label", "response", "note", "planned"],
};

export type SourceOp =
  | { type: "add"; id: string; value: Record<string, unknown> }
  | { type: "update"; id: string; patch: Record<string, unknown> }
  | { type: "remove"; id: string };

export function entityKindForOp(op: Operation): EntityKind {
  if (op.type.endsWith("System")) return "system";
  if (op.type.endsWith("DataStore")) return "dataStore";
  if (op.type.endsWith("External")) return "external";
  if (op.type.endsWith("Flow")) return "flow";
  if (op.type.endsWith("Migration")) return "migration";
  return "sequence";
}

export function sourceOpForOp(op: Operation): SourceOp {
  switch (op.type) {
    case "addSystem":
      return { type: "add", id: op.system.id, value: op.system as unknown as Record<string, unknown> };
    case "updateSystem":
      return { type: "update", id: op.id, patch: op.patch };
    case "removeSystem":
      return { type: "remove", id: op.id };
    case "addDataStore":
      return { type: "add", id: op.dataStore.id, value: op.dataStore as unknown as Record<string, unknown> };
    case "updateDataStore":
      return { type: "update", id: op.id, patch: op.patch };
    case "removeDataStore":
      return { type: "remove", id: op.id };
    case "addExternal":
      return { type: "add", id: op.external.id, value: op.external as unknown as Record<string, unknown> };
    case "updateExternal":
      return { type: "update", id: op.id, patch: op.patch };
    case "removeExternal":
      return { type: "remove", id: op.id };
    case "addFlow":
      return { type: "add", id: op.flow.id, value: op.flow as unknown as Record<string, unknown> };
    case "updateFlow":
      return { type: "update", id: op.id, patch: op.patch };
    case "removeFlow":
      return { type: "remove", id: op.id };
    case "addMigration":
      return { type: "add", id: op.migration.id, value: op.migration as unknown as Record<string, unknown> };
    case "updateMigration":
      return { type: "update", id: op.id, patch: op.patch };
    case "removeMigration":
      return { type: "remove", id: op.id };
    case "addSequence":
      return { type: "add", id: op.sequence.id, value: op.sequence as unknown as Record<string, unknown> };
    case "updateSequence":
      return { type: "update", id: op.id, patch: op.patch };
    case "removeSequence":
      return { type: "remove", id: op.id };
  }
}
