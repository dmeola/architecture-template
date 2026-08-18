import { listDataCommits } from "@/lib/github/client";

export const runtime = "nodejs";

export async function GET() {
  try {
    const commits = await listDataCommits();
    return Response.json({ ok: true, commits });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
