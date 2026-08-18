import { commitFiles, getChangedDataFiles, getFileContent, type CommitResult } from "./client";

/**
 * Restores the architecture data files to their state as of a past commit, as a new
 * commit on top of `main` — not a history rewrite. Only touches whichever of the
 * allowed data files that commit actually changed, leaving the rest untouched.
 *
 * Note: this doesn’t guarantee a revert can’t race with another write.
 * `commitFiles()` reads the current `main` ref and attempts a fast-forward update; if
 * `main` advances between `getRef` and `updateRef`, GitHub will reject the update and
 * the revert will fail (caller can retry).
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
