import type { UIMessage } from "ai";
import { staticModel } from "@/data/model";
import { deriveAppliedToolCalls } from "@/lib/chat/deriveOps";
import { applyOp, rawFromModel, type RawModel } from "@/lib/chat/ops";
import { validateOperation } from "@/lib/chat/validate";
import { entityKindForOp, sourceOpForOp, FILE_FOR_KIND, type EntityKind } from "@/lib/chat/entityKind";
import { applyOperationToSource } from "@/lib/chat/applyToSource";
import { commitFiles, getFileContent } from "@/lib/github/client";

export const runtime = "nodejs";
export const maxDuration = 30;

const BOT_EMAIL = process.env.CHAT_BOT_EMAIL ?? "architecture-chatbot@example.com";

export async function POST(req: Request) {
  const { messages, authorName }: { messages: UIMessage[]; authorName?: string } =
    await req.json();

  const calls = deriveAppliedToolCalls(messages);
  if (calls.length === 0) {
    return Response.json({ ok: false, error: "Nothing to save." }, { status: 400 });
  }

  // Re-validate every operation from scratch — never trust that the client-derived
  // history is still valid; the bundled model or another save could have moved on.
  let raw: RawModel = rawFromModel(staticModel);
  for (const call of calls) {
    const result = validateOperation(call.op, raw);
    if (!result.ok) {
      return Response.json(
        { ok: false, error: `Re-validation failed for "${call.message}": ${result.error}` },
        { status: 409 },
      );
    }
    raw = applyOp(raw, call.op);
  }

  // Group operations by the file they touch, applying each file's operations in order
  // against its current content on GitHub — not the (potentially stale) bundled model —
  // so a save reflects whatever is really on `main` right now.
  const opsByKind = new Map<EntityKind, (typeof calls)[number][]>();
  for (const call of calls) {
    const kind = entityKindForOp(call.op);
    const existing = opsByKind.get(kind) ?? [];
    existing.push(call);
    opsByKind.set(kind, existing);
  }

  const writes: { path: string; content: string }[] = [];
  try {
    for (const [kind, kindCalls] of opsByKind) {
      const { path, arrayName } = FILE_FOR_KIND[kind];
      let content = await getFileContent(path);
      for (const call of kindCalls) {
        content = applyOperationToSource(content, arrayName, kind, sourceOpForOp(call.op));
      }
      writes.push({ path, content });
    }
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: `Couldn't apply changes to the live file content — it may have changed since you started: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 409 },
    );
  }

  const message = [
    "Architecture update via chat",
    "",
    ...calls.map((call) => `- ${call.message}`),
  ].join("\n");

  try {
    const commit = await commitFiles(writes, message, {
      name: authorName?.trim() || "Architecture Chatbot",
      email: BOT_EMAIL,
    });
    return Response.json({ ok: true, commitUrl: commit.htmlUrl, commitSha: commit.sha });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
