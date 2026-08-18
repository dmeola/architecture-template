import type { Operation } from "./ops";

interface ToolPart {
  type: string;
  state?: string;
  input?: unknown;
  output?: unknown;
}

interface MessageLike {
  role: string;
  parts?: ToolPart[];
}

interface ToolOutput {
  ok: boolean;
  message: string;
}

/**
 * Reconstructs the `Operation` a tool call represents from its raw input — the inverse
 * of what each tool's `execute()` in `tools.ts` builds internally. Kept in sync with
 * that file: same tool name, same input shape.
 */
function operationFromToolCall(
  toolName: string,
  input: Record<string, unknown>,
): Operation | null {
  const { id, patch, ...rest } = input as {
    id: string;
    patch?: Record<string, unknown>;
  };
  switch (toolName) {
    case "addSystem":
      return { type: "addSystem", system: { kind: "system", id, ...rest } } as Operation;
    case "updateSystem":
      return { type: "updateSystem", id, patch: patch ?? {} };
    case "removeSystem":
      return { type: "removeSystem", id };
    case "addDataStore":
      return {
        type: "addDataStore",
        dataStore: { kind: "datastore", id, ...rest },
      } as Operation;
    case "updateDataStore":
      return { type: "updateDataStore", id, patch: patch ?? {} };
    case "removeDataStore":
      return { type: "removeDataStore", id };
    case "addExternal":
      return {
        type: "addExternal",
        external: { kind: "external", id, ...rest },
      } as Operation;
    case "updateExternal":
      return { type: "updateExternal", id, patch: patch ?? {} };
    case "removeExternal":
      return { type: "removeExternal", id };
    case "addFlow":
      return { type: "addFlow", flow: { id, ...rest } } as Operation;
    case "updateFlow":
      return { type: "updateFlow", id, patch: patch ?? {} };
    case "removeFlow":
      return { type: "removeFlow", id };
    case "addMigration":
      return { type: "addMigration", migration: { id, ...rest } } as Operation;
    case "updateMigration":
      return { type: "updateMigration", id, patch: patch ?? {} };
    case "removeMigration":
      return { type: "removeMigration", id };
    case "addSequence":
      return { type: "addSequence", sequence: { id, ...rest } } as Operation;
    case "updateSequence":
      return { type: "updateSequence", id, patch: patch ?? {} };
    case "removeSequence":
      return { type: "removeSequence", id };
    default:
      return null;
  }
}

export interface AppliedToolCall {
  op: Operation;
  message: string;
}

/**
 * Walks a chat's message history and reconstructs the ordered list of tool calls that
 * actually succeeded (validation passed). Shared by the server — to rebuild draft state
 * before executing a new turn's tool calls — and the client, to derive the live preview
 * and the "proposed changes" diff cards. Never trust this alone for a write: the server
 * re-validates every operation again before committing (see Phase 2).
 */
export function deriveAppliedToolCalls(
  messages: MessageLike[],
): AppliedToolCall[] {
  const calls: AppliedToolCall[] = [];
  for (const message of messages) {
    if (message.role !== "assistant" || !message.parts) continue;
    for (const part of message.parts) {
      if (!part.type.startsWith("tool-")) continue;
      if (part.state !== "output-available") continue;
      const output = part.output as ToolOutput | undefined;
      if (!output?.ok) continue;
      const toolName = part.type.slice("tool-".length);
      const op = operationFromToolCall(
        toolName,
        (part.input ?? {}) as Record<string, unknown>,
      );
      if (op) calls.push({ op, message: output.message });
    }
  }
  return calls;
}

export function deriveOpsFromMessages(messages: MessageLike[]): Operation[] {
  return deriveAppliedToolCalls(messages).map((call) => call.op);
}
