import { revertCommit } from "@/lib/github/revert";

export const runtime = "nodejs";

const BOT_EMAIL = process.env.CHAT_BOT_EMAIL ?? "architecture-chatbot@example.com";

export async function POST(req: Request) {
  const { sha, authorName }: { sha?: string; authorName?: string } = await req.json();
  if (!sha) {
    return Response.json({ ok: false, error: "Missing commit sha." }, { status: 400 });
  }

  try {
    const commit = await revertCommit(sha, {
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
