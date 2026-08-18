import { tool } from "ai";
import { z } from "zod";
import {
  DOMAINS,
  FLOW_KINDS,
  MIGRATION_STATUSES,
  SYSTEM_STATUSES,
  TIERS,
  type Domain,
  type FlowKind,
  type MigrationStatus,
  type SystemStatus,
  type Tier,
} from "@/config/taxonomy";
import { applyOp, type Operation, type RawModel } from "./ops";
import { validateOperation } from "./validate";

const tierIds = TIERS.map((t) => t.id) as [Tier, ...Tier[]];
const systemStatusIds = SYSTEM_STATUSES.map((s) => s.id) as [
  SystemStatus,
  ...SystemStatus[],
];
const flowKindIds = FLOW_KINDS.map((k) => k.id) as [FlowKind, ...FlowKind[]];
const domainIds = DOMAINS.map((d) => d.id) as [Domain, ...Domain[]];
const migrationStatusIds = MIGRATION_STATUSES.map((s) => s.id) as [
  MigrationStatus,
  ...MigrationStatus[],
];
const phaseSchema = z.enum(["current", "target", "both"]);

const FACTS_ONLY =
  "Only fill factual fields (description, notes, summary, stack, runtime) from what the user has stated in this conversation. Never invent architecture facts — if something factual is missing, ask the user instead of guessing.";

const systemSchema = z.object({
  name: z.string(),
  tier: z.enum(tierIds).describe(`One of: ${tierIds.join(", ")}`),
  status: z.enum(systemStatusIds).describe(`One of: ${systemStatusIds.join(", ")}`),
  description: z.string().describe(FACTS_ONLY),
  stack: z.array(z.string()),
  runtime: z.string(),
  repoPath: z.string().optional(),
  url: z.string().optional(),
  notes: z.array(z.string()).optional(),
});

const dataStoreSchema = z.object({
  name: z.string(),
  technology: z.string(),
  description: z.string().describe(FACTS_ONLY),
  contents: z.array(z.string()),
  phase: phaseSchema
    .optional()
    .describe("Omit for stores that exist on both sides of the cutover."),
});

const externalSchema = z.object({
  name: z.string(),
  category: z.string(),
  description: z.string().describe(FACTS_ONLY),
  phase: phaseSchema
    .optional()
    .describe("Omit for third parties retained through the cutover."),
});

const flowSchema = z.object({
  source: z.string().describe("Source node id"),
  target: z.string().describe("Target node id"),
  kind: z.enum(flowKindIds).describe(`One of: ${flowKindIds.join(", ")}`),
  domains: z
    .array(z.enum(domainIds))
    .min(1)
    .describe(`Non-empty, from: ${domainIds.join(", ")}`),
  label: z.string(),
  description: z.string().optional(),
  planned: z
    .boolean()
    .optional()
    .describe("True renders the edge dashed as a target-state-only flow."),
  step: z
    .number()
    .optional()
    .describe("Position in an animated numbered trace within one domain."),
  stepDomain: z.enum(domainIds).optional(),
});

const migrationSchema = z.object({
  title: z.string(),
  from: z.array(z.string()).min(1).describe("Legacy node ids"),
  to: z.array(z.string()).min(1).describe("Modern node ids"),
  status: z
    .enum(migrationStatusIds)
    .describe(`One of: ${migrationStatusIds.join(", ")}`),
  summary: z.string().describe(FACTS_ONLY),
  deadline: z.string().optional(),
});

const sequenceMessageSchema = z.object({
  from: z.string(),
  to: z.string(),
  kind: z.enum(flowKindIds),
  label: z.string(),
  response: z.boolean().optional().describe("True renders a dashed return arrow."),
  note: z.string().optional(),
  planned: z.boolean().optional(),
});

const sequenceSchema = z.object({
  title: z.string(),
  domain: z.enum(domainIds).describe(`One of: ${domainIds.join(", ")}`),
  summary: z.string().describe(FACTS_ONLY),
  participants: z
    .array(z.string())
    .min(1)
    .describe("Left-to-right lifeline order; node ids or known diagram actors"),
  messages: z.array(sequenceMessageSchema),
});

/**
 * Builds the chat's tool set, bound to a mutable session state object so sequential
 * tool calls within one turn (e.g. add a system, then a flow referencing it) see each
 * other's effects. `state.raw` is read and updated in place by `run()`.
 */
export function createTools(state: { raw: RawModel }) {
  function run(op: Operation, describe: string) {
    const result = validateOperation(op, state.raw);
    if (!result.ok) {
      return { ok: false as const, message: result.error };
    }
    state.raw = applyOp(state.raw, op);
    return { ok: true as const, message: describe };
  }

  return {
    findEntities: tool({
      description:
        "Search the current model for systems, data stores, externals, flows, migrations, and sequences by name or id. Call this before any update/remove tool call whenever the user refers to something by name — never ask the user for an internal id.",
      inputSchema: z.object({
        query: z.string().describe("Name, id, or partial text to search for"),
      }),
      execute: async ({ query }) => {
        const q = query.trim().toLowerCase();
        const matches: {
          entityType: string;
          id: string;
          label: string;
          detail?: string;
        }[] = [];
        const push = (
          entityType: string,
          id: string,
          label: string,
          detail?: string,
        ) => {
          if (`${id} ${label} ${detail ?? ""}`.toLowerCase().includes(q)) {
            matches.push({ entityType, id, label, detail });
          }
        };
        for (const s of state.raw.systems) push("system", s.id, s.name, s.tier);
        for (const d of state.raw.datastores)
          push("dataStore", d.id, d.name, d.technology);
        for (const e of state.raw.externals)
          push("external", e.id, e.name, e.category);
        for (const f of state.raw.flows)
          push("flow", f.id, f.label, `${f.source} → ${f.target}`);
        for (const m of state.raw.migrations) push("migration", m.id, m.title);
        for (const sq of state.raw.sequences) push("sequence", sq.id, sq.title);
        return { matches };
      },
    }),

    addSystem: tool({
      description: "Add a new first-party system to the architecture model.",
      inputSchema: systemSchema.extend({
        id: z.string().describe("Stable kebab-case id"),
      }),
      execute: async ({ id, ...rest }) =>
        run(
          { type: "addSystem", system: { kind: "system", id, ...rest } },
          `Added system "${rest.name}" (\`${id}\`).`,
        ),
    }),
    updateSystem: tool({
      description: "Update fields on an existing system.",
      inputSchema: z.object({ id: z.string(), patch: systemSchema.partial() }),
      execute: async ({ id, patch }) =>
        run({ type: "updateSystem", id, patch }, `Updated system \`${id}\`.`),
    }),
    removeSystem: tool({
      description:
        "Remove a system. Blocked if any flow, migration, or sequence still references it — remove those first.",
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) =>
        run({ type: "removeSystem", id }, `Removed system \`${id}\`.`),
    }),

    addDataStore: tool({
      description: "Add a new data store to the architecture model.",
      inputSchema: dataStoreSchema.extend({ id: z.string() }),
      execute: async ({ id, ...rest }) =>
        run(
          { type: "addDataStore", dataStore: { kind: "datastore", id, ...rest } },
          `Added data store "${rest.name}" (\`${id}\`).`,
        ),
    }),
    updateDataStore: tool({
      description: "Update fields on an existing data store.",
      inputSchema: z.object({ id: z.string(), patch: dataStoreSchema.partial() }),
      execute: async ({ id, patch }) =>
        run({ type: "updateDataStore", id, patch }, `Updated data store \`${id}\`.`),
    }),
    removeDataStore: tool({
      description:
        "Remove a data store. Blocked if any flow, migration, or sequence still references it.",
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) =>
        run({ type: "removeDataStore", id }, `Removed data store \`${id}\`.`),
    }),

    addExternal: tool({
      description: "Add a new third-party/external service to the architecture model.",
      inputSchema: externalSchema.extend({ id: z.string() }),
      execute: async ({ id, ...rest }) =>
        run(
          { type: "addExternal", external: { kind: "external", id, ...rest } },
          `Added external "${rest.name}" (\`${id}\`).`,
        ),
    }),
    updateExternal: tool({
      description: "Update fields on an existing external.",
      inputSchema: z.object({ id: z.string(), patch: externalSchema.partial() }),
      execute: async ({ id, patch }) =>
        run({ type: "updateExternal", id, patch }, `Updated external \`${id}\`.`),
    }),
    removeExternal: tool({
      description:
        "Remove an external. Blocked if any flow, migration, or sequence still references it.",
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) =>
        run({ type: "removeExternal", id }, `Removed external \`${id}\`.`),
    }),

    addFlow: tool({
      description: "Add a new data-flow edge between two existing nodes.",
      inputSchema: flowSchema.extend({ id: z.string() }),
      execute: async ({ id, ...rest }) =>
        run(
          { type: "addFlow", flow: { id, ...rest } },
          `Added flow \`${id}\`: ${rest.source} → ${rest.target} ("${rest.label}").`,
        ),
    }),
    updateFlow: tool({
      description: "Update fields on an existing flow.",
      inputSchema: z.object({ id: z.string(), patch: flowSchema.partial() }),
      execute: async ({ id, patch }) =>
        run({ type: "updateFlow", id, patch }, `Updated flow \`${id}\`.`),
    }),
    removeFlow: tool({
      description: "Remove a flow.",
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) => run({ type: "removeFlow", id }, `Removed flow \`${id}\`.`),
    }),

    addMigration: tool({
      description: "Add a new legacy-to-modern migration entry.",
      inputSchema: migrationSchema.extend({ id: z.string() }),
      execute: async ({ id, ...rest }) =>
        run(
          { type: "addMigration", migration: { id, ...rest } },
          `Added migration \`${id}\`: "${rest.title}".`,
        ),
    }),
    updateMigration: tool({
      description: "Update fields on an existing migration.",
      inputSchema: z.object({ id: z.string(), patch: migrationSchema.partial() }),
      execute: async ({ id, patch }) =>
        run({ type: "updateMigration", id, patch }, `Updated migration \`${id}\`.`),
    }),
    removeMigration: tool({
      description: "Remove a migration entry.",
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) =>
        run({ type: "removeMigration", id }, `Removed migration \`${id}\`.`),
    }),

    addSequence: tool({
      description: "Add a new sequence-diagram scenario.",
      inputSchema: sequenceSchema.extend({ id: z.string() }),
      execute: async ({ id, ...rest }) =>
        run(
          { type: "addSequence", sequence: { id, ...rest } },
          `Added sequence \`${id}\`: "${rest.title}".`,
        ),
    }),
    updateSequence: tool({
      description: "Update fields on an existing sequence.",
      inputSchema: z.object({ id: z.string(), patch: sequenceSchema.partial() }),
      execute: async ({ id, patch }) =>
        run({ type: "updateSequence", id, patch }, `Updated sequence \`${id}\`.`),
    }),
    removeSequence: tool({
      description: "Remove a sequence scenario.",
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) =>
        run({ type: "removeSequence", id }, `Removed sequence \`${id}\`.`),
    }),
  };
}
