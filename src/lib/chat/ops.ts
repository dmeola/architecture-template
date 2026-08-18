import { buildModel, type Model } from "@/data/model";
import type {
  DataStoreDef,
  ExternalDef,
  FlowDef,
  MigrationDef,
  SequenceDef,
  SystemDef,
} from "@/data/types";

/** The raw, editable arrays behind a `Model` — what operations actually mutate. */
export interface RawModel {
  systems: SystemDef[];
  datastores: DataStoreDef[];
  externals: ExternalDef[];
  flows: FlowDef[];
  migrations: MigrationDef[];
  sequences: SequenceDef[];
  actors: Record<string, string>;
}

export function rawFromModel(model: Model): RawModel {
  return {
    systems: model.systems,
    datastores: model.datastores,
    externals: model.externals,
    flows: model.flows,
    migrations: model.migrations,
    sequences: model.sequences,
    actors: model.actors,
  };
}

export type Operation =
  | { type: "addSystem"; system: SystemDef }
  | { type: "updateSystem"; id: string; patch: Partial<Omit<SystemDef, "kind" | "id">> }
  | { type: "removeSystem"; id: string }
  | { type: "addDataStore"; dataStore: DataStoreDef }
  | { type: "updateDataStore"; id: string; patch: Partial<Omit<DataStoreDef, "kind" | "id">> }
  | { type: "removeDataStore"; id: string }
  | { type: "addExternal"; external: ExternalDef }
  | { type: "updateExternal"; id: string; patch: Partial<Omit<ExternalDef, "kind" | "id">> }
  | { type: "removeExternal"; id: string }
  | { type: "addFlow"; flow: FlowDef }
  | { type: "updateFlow"; id: string; patch: Partial<Omit<FlowDef, "id">> }
  | { type: "removeFlow"; id: string }
  | { type: "addMigration"; migration: MigrationDef }
  | { type: "updateMigration"; id: string; patch: Partial<Omit<MigrationDef, "id">> }
  | { type: "removeMigration"; id: string }
  | { type: "addSequence"; sequence: SequenceDef }
  | { type: "updateSequence"; id: string; patch: Partial<Omit<SequenceDef, "id">> }
  | { type: "removeSequence"; id: string };

/** Applies one already-validated operation to a raw model. Pure — returns a new object. */
export function applyOp(base: RawModel, op: Operation): RawModel {
  switch (op.type) {
    case "addSystem":
      return { ...base, systems: [...base.systems, op.system] };
    case "updateSystem":
      return {
        ...base,
        systems: base.systems.map((s) =>
          s.id === op.id ? { ...s, ...op.patch } : s,
        ),
      };
    case "removeSystem":
      return { ...base, systems: base.systems.filter((s) => s.id !== op.id) };

    case "addDataStore":
      return { ...base, datastores: [...base.datastores, op.dataStore] };
    case "updateDataStore":
      return {
        ...base,
        datastores: base.datastores.map((d) =>
          d.id === op.id ? { ...d, ...op.patch } : d,
        ),
      };
    case "removeDataStore":
      return {
        ...base,
        datastores: base.datastores.filter((d) => d.id !== op.id),
      };

    case "addExternal":
      return { ...base, externals: [...base.externals, op.external] };
    case "updateExternal":
      return {
        ...base,
        externals: base.externals.map((e) =>
          e.id === op.id ? { ...e, ...op.patch } : e,
        ),
      };
    case "removeExternal":
      return {
        ...base,
        externals: base.externals.filter((e) => e.id !== op.id),
      };

    case "addFlow":
      return { ...base, flows: [...base.flows, op.flow] };
    case "updateFlow":
      return {
        ...base,
        flows: base.flows.map((f) =>
          f.id === op.id ? { ...f, ...op.patch } : f,
        ),
      };
    case "removeFlow":
      return { ...base, flows: base.flows.filter((f) => f.id !== op.id) };

    case "addMigration":
      return { ...base, migrations: [...base.migrations, op.migration] };
    case "updateMigration":
      return {
        ...base,
        migrations: base.migrations.map((m) =>
          m.id === op.id ? { ...m, ...op.patch } : m,
        ),
      };
    case "removeMigration":
      return {
        ...base,
        migrations: base.migrations.filter((m) => m.id !== op.id),
      };

    case "addSequence":
      return { ...base, sequences: [...base.sequences, op.sequence] };
    case "updateSequence":
      return {
        ...base,
        sequences: base.sequences.map((s) =>
          s.id === op.id ? { ...s, ...op.patch } : s,
        ),
      };
    case "removeSequence":
      return {
        ...base,
        sequences: base.sequences.filter((s) => s.id !== op.id),
      };
  }
}

export function applyOps(base: RawModel, ops: Operation[]): RawModel {
  return ops.reduce(applyOp, base);
}

export function modelFromRaw(raw: RawModel): Model {
  return buildModel(
    raw.systems,
    raw.datastores,
    raw.externals,
    raw.flows,
    raw.migrations,
    raw.sequences,
    raw.actors,
  );
}
