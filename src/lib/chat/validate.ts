import {
  DOMAINS,
  FLOW_KINDS,
  MIGRATION_STATUSES,
  SYSTEM_STATUSES,
  TIERS,
} from "@/config/taxonomy";
import { modelFromRaw, type Operation, type RawModel } from "./ops";

export type ValidationResult = { ok: true } | { ok: false; error: string };

const ok: ValidationResult = { ok: true };
const fail = (error: string): ValidationResult => ({ ok: false, error });

function oneOf(value: string, allowed: readonly { id: string }[]): boolean {
  return allowed.some((entry) => entry.id === value);
}

/** Human-readable references to a node id, across flows/migrations/sequences. */
function describeNodeReferences(raw: RawModel, id: string): string[] {
  const refs: string[] = [];
  for (const flow of raw.flows) {
    if (flow.source === id || flow.target === id) {
      refs.push(`flow \`${flow.id}\` ("${flow.label}")`);
    }
  }
  for (const migration of raw.migrations) {
    if (migration.from.includes(id) || migration.to.includes(id)) {
      refs.push(`migration \`${migration.id}\` ("${migration.title}")`);
    }
  }
  for (const sequence of raw.sequences) {
    const inParticipants = sequence.participants.includes(id);
    const inMessages = sequence.messages.some(
      (m) => m.from === id || m.to === id,
    );
    if (inParticipants || inMessages) {
      refs.push(`sequence \`${sequence.id}\` ("${sequence.title}")`);
    }
  }
  return refs;
}

function blockedByReferences(raw: RawModel, id: string): ValidationResult | null {
  const refs = describeNodeReferences(raw, id);
  if (refs.length === 0) return null;
  return fail(
    `Can't remove \`${id}\` — still referenced by ${refs.join(", ")}. Remove or repoint those first.`,
  );
}

export function validateOperation(
  op: Operation,
  raw: RawModel,
): ValidationResult {
  const model = modelFromRaw(raw);

  switch (op.type) {
    case "addSystem": {
      if (model.nodeById.has(op.system.id)) {
        return fail(`A node with id \`${op.system.id}\` already exists.`);
      }
      if (!oneOf(op.system.tier, TIERS)) {
        return fail(
          `\`${op.system.tier}\` isn't a known tier. Valid tiers: ${TIERS.map((t) => t.id).join(", ")}.`,
        );
      }
      if (!oneOf(op.system.status, SYSTEM_STATUSES)) {
        return fail(
          `\`${op.system.status}\` isn't a known status. Valid statuses: ${SYSTEM_STATUSES.map((s) => s.id).join(", ")}.`,
        );
      }
      return ok;
    }
    case "updateSystem": {
      if (!raw.systems.some((s) => s.id === op.id)) {
        return fail(`No system with id \`${op.id}\`.`);
      }
      if (op.patch.tier !== undefined && !oneOf(op.patch.tier, TIERS)) {
        return fail(`\`${op.patch.tier}\` isn't a known tier.`);
      }
      if (op.patch.status !== undefined && !oneOf(op.patch.status, SYSTEM_STATUSES)) {
        return fail(`\`${op.patch.status}\` isn't a known status.`);
      }
      return ok;
    }
    case "removeSystem": {
      if (!raw.systems.some((s) => s.id === op.id)) {
        return fail(`No system with id \`${op.id}\`.`);
      }
      return blockedByReferences(raw, op.id) ?? ok;
    }

    case "addDataStore": {
      if (model.nodeById.has(op.dataStore.id)) {
        return fail(`A node with id \`${op.dataStore.id}\` already exists.`);
      }
      return ok;
    }
    case "updateDataStore": {
      if (!raw.datastores.some((d) => d.id === op.id)) {
        return fail(`No data store with id \`${op.id}\`.`);
      }
      return ok;
    }
    case "removeDataStore": {
      if (!raw.datastores.some((d) => d.id === op.id)) {
        return fail(`No data store with id \`${op.id}\`.`);
      }
      return blockedByReferences(raw, op.id) ?? ok;
    }

    case "addExternal": {
      if (model.nodeById.has(op.external.id)) {
        return fail(`A node with id \`${op.external.id}\` already exists.`);
      }
      return ok;
    }
    case "updateExternal": {
      if (!raw.externals.some((e) => e.id === op.id)) {
        return fail(`No external with id \`${op.id}\`.`);
      }
      return ok;
    }
    case "removeExternal": {
      if (!raw.externals.some((e) => e.id === op.id)) {
        return fail(`No external with id \`${op.id}\`.`);
      }
      return blockedByReferences(raw, op.id) ?? ok;
    }

    case "addFlow": {
      if (raw.flows.some((f) => f.id === op.flow.id)) {
        return fail(`A flow with id \`${op.flow.id}\` already exists.`);
      }
      if (!model.nodeById.has(op.flow.source)) {
        return fail(`Flow source \`${op.flow.source}\` doesn't exist.`);
      }
      if (!model.nodeById.has(op.flow.target)) {
        return fail(`Flow target \`${op.flow.target}\` doesn't exist.`);
      }
      if (!oneOf(op.flow.kind, FLOW_KINDS)) {
        return fail(`\`${op.flow.kind}\` isn't a known flow kind.`);
      }
      if (op.flow.domains.length === 0) {
        return fail("A flow needs at least one domain.");
      }
      for (const domain of op.flow.domains) {
        if (!oneOf(domain, DOMAINS)) {
          return fail(`\`${domain}\` isn't a known domain.`);
        }
      }
      return ok;
    }
    case "updateFlow": {
      const flow = raw.flows.find((f) => f.id === op.id);
      if (!flow) return fail(`No flow with id \`${op.id}\`.`);
      const source = op.patch.source ?? flow.source;
      const target = op.patch.target ?? flow.target;
      if (!model.nodeById.has(source)) {
        return fail(`Flow source \`${source}\` doesn't exist.`);
      }
      if (!model.nodeById.has(target)) {
        return fail(`Flow target \`${target}\` doesn't exist.`);
      }
      if (op.patch.kind !== undefined && !oneOf(op.patch.kind, FLOW_KINDS)) {
        return fail(`\`${op.patch.kind}\` isn't a known flow kind.`);
      }
      if (op.patch.domains !== undefined) {
        if (op.patch.domains.length === 0) {
          return fail("A flow needs at least one domain.");
        }
        for (const domain of op.patch.domains) {
          if (!oneOf(domain, DOMAINS)) {
            return fail(`\`${domain}\` isn't a known domain.`);
          }
        }
      }
      return ok;
    }
    case "removeFlow": {
      if (!raw.flows.some((f) => f.id === op.id)) {
        return fail(`No flow with id \`${op.id}\`.`);
      }
      return ok;
    }

    case "addMigration": {
      if (raw.migrations.some((m) => m.id === op.migration.id)) {
        return fail(`A migration with id \`${op.migration.id}\` already exists.`);
      }
      if (!oneOf(op.migration.status, MIGRATION_STATUSES)) {
        return fail(`\`${op.migration.status}\` isn't a known migration status.`);
      }
      if (op.migration.from.length === 0 || op.migration.to.length === 0) {
        return fail("A migration needs at least one `from` and one `to` node.");
      }
      for (const id of [...op.migration.from, ...op.migration.to]) {
        if (!model.nodeById.has(id)) {
          return fail(`Migration references unknown node \`${id}\`.`);
        }
      }
      return ok;
    }
    case "updateMigration": {
      const migration = raw.migrations.find((m) => m.id === op.id);
      if (!migration) return fail(`No migration with id \`${op.id}\`.`);
      if (
        op.patch.status !== undefined &&
        !oneOf(op.patch.status, MIGRATION_STATUSES)
      ) {
        return fail(`\`${op.patch.status}\` isn't a known migration status.`);
      }
      for (const id of [...(op.patch.from ?? []), ...(op.patch.to ?? [])]) {
        if (!model.nodeById.has(id)) {
          return fail(`Migration references unknown node \`${id}\`.`);
        }
      }
      return ok;
    }
    case "removeMigration": {
      if (!raw.migrations.some((m) => m.id === op.id)) {
        return fail(`No migration with id \`${op.id}\`.`);
      }
      return ok;
    }

    case "addSequence": {
      if (raw.sequences.some((s) => s.id === op.sequence.id)) {
        return fail(`A sequence with id \`${op.sequence.id}\` already exists.`);
      }
      if (!oneOf(op.sequence.domain, DOMAINS)) {
        return fail(`\`${op.sequence.domain}\` isn't a known domain.`);
      }
      if (op.sequence.participants.length === 0) {
        return fail("A sequence needs at least one participant.");
      }
      const known = (id: string) =>
        model.nodeById.has(id) || Object.hasOwn(raw.actors, id);
      for (const id of op.sequence.participants) {
        if (!known(id)) {
          return fail(
            `Participant \`${id}\` is neither an existing node nor a known diagram actor. Use an existing id.`,
          );
        }
      }
      for (const message of op.sequence.messages) {
        if (!known(message.from) || !known(message.to)) {
          return fail(
            `Message references \`${message.from}\` → \`${message.to}\`, but one of those isn't a known participant.`,
          );
        }
        if (!oneOf(message.kind, FLOW_KINDS)) {
          return fail(`\`${message.kind}\` isn't a known message kind.`);
        }
      }
      return ok;
    }
    case "updateSequence": {
      const sequence = raw.sequences.find((s) => s.id === op.id);
      if (!sequence) return fail(`No sequence with id \`${op.id}\`.`);
      if (op.patch.domain !== undefined && !oneOf(op.patch.domain, DOMAINS)) {
        return fail(`\`${op.patch.domain}\` isn't a known domain.`);
      }
      const participants = op.patch.participants ?? sequence.participants;
      const known = (id: string) =>
        model.nodeById.has(id) || Object.hasOwn(raw.actors, id);
      for (const id of participants) {
        if (!known(id)) {
          return fail(`Participant \`${id}\` isn't a known node or actor.`);
        }
      }
      if (op.patch.messages !== undefined) {
        for (const message of op.patch.messages) {
          if (!known(message.from) || !known(message.to)) {
            return fail(
              `Message references \`${message.from}\` → \`${message.to}\`, but one of those isn't a known participant.`,
            );
          }
          if (!oneOf(message.kind, FLOW_KINDS)) {
            return fail(`\`${message.kind}\` isn't a known message kind.`);
          }
        }
      }
      return ok;
    }
    case "removeSequence": {
      if (!raw.sequences.some((s) => s.id === op.id)) {
        return fail(`No sequence with id \`${op.id}\`.`);
      }
      return ok;
    }
  }
}
