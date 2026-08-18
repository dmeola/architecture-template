import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";

const BRANCH = "main";

/**
 * The only files this integration is ever allowed to write to — enforced here,
 * independent of the chat tool layer's own scoping, so a prompt-injected or
 * jailbroken model still cannot make this write outside the architecture data.
 */
const ALLOWED_PATHS = new Set([
  "src/data/systems.ts",
  "src/data/datastores.ts",
  "src/data/externals.ts",
  "src/data/flows.ts",
  "src/data/migrations.ts",
  "src/data/sequences.ts",
]);

function getRepo(): { owner: string; repo: string } {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  if (!owner || !repo) {
    throw new Error(
      "GitHub repo isn't configured — set GITHUB_OWNER and GITHUB_REPO to the client's repo.",
    );
  }
  return { owner, repo };
}

function getOctokit(): Octokit {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
  if (!appId || !privateKey || !installationId) {
    throw new Error(
      "GitHub App isn't configured — set GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, and GITHUB_APP_INSTALLATION_ID.",
    );
  }
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId,
      // Env vars typically can't hold real newlines, so `\n` arrives as the two-char
      // escape sequence; a PEM key needs actual line breaks to parse.
      privateKey: privateKey.replace(/\\n/g, "\n"),
      installationId,
    },
  });
}

export interface FileWrite {
  path: string;
  content: string;
}

export interface CommitResult {
  sha: string;
  htmlUrl: string;
}

/** Fetches a file's current text content from the given ref (defaults to `main`). */
export async function getFileContent(path: string, ref: string = BRANCH): Promise<string> {
  if (!ALLOWED_PATHS.has(path)) {
    throw new Error(`Refusing to read outside the allowed data files: ${path}`);
  }
  const { owner, repo } = getRepo();
  const octokit = getOctokit();
  const { data } = await octokit.repos.getContent({ owner, repo, path, ref });
  if (Array.isArray(data) || data.type !== "file" || !("content" in data)) {
    throw new Error(`Expected a file at ${path}, got something else.`);
  }
  return Buffer.from(data.content, "base64").toString("utf-8");
}

/**
 * Commits one or more files atomically to `main` via the Git Data API (blob → tree →
 * commit → ref update) — a logical change spanning multiple files (e.g. a new system
 * plus its flows) lands as a single commit, not several.
 */
export async function commitFiles(
  writes: FileWrite[],
  message: string,
  author: { name: string; email: string },
): Promise<CommitResult> {
  for (const write of writes) {
    if (!ALLOWED_PATHS.has(write.path)) {
      throw new Error(`Refusing to write outside the allowed data files: ${write.path}`);
    }
  }
  if (writes.length === 0) {
    throw new Error("Nothing to commit.");
  }

  const { owner, repo } = getRepo();
  const octokit = getOctokit();

  const { data: ref } = await octokit.git.getRef({ owner, repo, ref: `heads/${BRANCH}` });
  const baseSha = ref.object.sha;

  const { data: baseCommit } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: baseSha,
  });

  const blobs = await Promise.all(
    writes.map(async (write) => {
      const { data: blob } = await octokit.git.createBlob({
        owner,
        repo,
        content: write.content,
        encoding: "utf-8",
      });
      return { path: write.path, sha: blob.sha };
    }),
  );

  const { data: tree } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: baseCommit.tree.sha,
    tree: blobs.map((blob) => ({
      path: blob.path,
      mode: "100644" as const,
      type: "blob" as const,
      sha: blob.sha,
    })),
  });

  const { data: commit } = await octokit.git.createCommit({
    owner,
    repo,
    message,
    tree: tree.sha,
    parents: [baseSha],
    author: { name: author.name, email: author.email, date: new Date().toISOString() },
  });

  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${BRANCH}`,
    sha: commit.sha,
  });

  return { sha: commit.sha, htmlUrl: `https://github.com/${owner}/${repo}/commit/${commit.sha}` };
}

export interface CommitSummary {
  sha: string;
  message: string;
  authorName: string;
  date: string;
  htmlUrl: string;
}

/** Recent commits touching the architecture data, newest first. */
export async function listDataCommits(limit = 30): Promise<CommitSummary[]> {
  const { owner, repo } = getRepo();
  const octokit = getOctokit();
  const { data } = await octokit.repos.listCommits({
    owner,
    repo,
    path: "src/data",
    per_page: limit,
  });
  return data.map((commit) => ({
    sha: commit.sha,
    message: commit.commit.message.split("\n")[0],
    authorName: commit.commit.author?.name ?? commit.author?.login ?? "Unknown",
    date: commit.commit.author?.date ?? commit.commit.committer?.date ?? "",
    htmlUrl: commit.html_url,
  }));
}

/** Which of the allowed data files a given commit touched. */
export async function getChangedDataFiles(sha: string): Promise<string[]> {
  const { owner, repo } = getRepo();
  const octokit = getOctokit();
  const { data } = await octokit.repos.getCommit({ owner, repo, ref: sha });
  return (data.files ?? [])
    .map((file) => file.filename)
    .filter((path): path is string => !!path && ALLOWED_PATHS.has(path));
}
