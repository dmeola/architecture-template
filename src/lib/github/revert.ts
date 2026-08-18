import { commitFiles, getChangedDataFiles, getFileContent, type CommitResult } from "./client";

/**
 * Restores the architecture data files to their state as of a past commit, as a new
 * commit on top of `main` — not a history rewrite. Only touches whichever of the
 * allowed data files that commit actually changed, leaving the rest untouched.
 *
 * There's no explicit concurrency check here: `commitFiles` always reads the current
 * `main` ref fresh at call time and builds on top of it, so a revert always lands as
 * the newest commit rather than failing on a stale precondition the way a Contents-API
 * PUT with a blob SHA would.
 */
export async function revertCommit(
  sha: string,
  author: { name: string; email: string },
): Promise<CommitResult> {
  const paths = await getChangedDataFiles(sha);
  if (paths.length === 0) {
    throw new Error("That commit didn't touch any of the architecture data files.");
  }

  const writes = await Promise.all(
    paths.map(async (path) => ({ path, content: await getFileContent(path, sha) })),
  );

  const message = `Revert src/data to state at ${sha.slice(0, 8)}\n\nRestores: ${paths.join(", ")}`;
  return commitFiles(writes, message, author);
}
