"use client";

import { useEffect, useState } from "react";

interface CommitSummary {
  sha: string;
  message: string;
  authorName: string;
  date: string;
  htmlUrl: string;
}

interface RevertOutcome {
  sha: string;
  ok: boolean;
  message: string;
}

export function HistoryPanel() {
  const [commits, setCommits] = useState<CommitSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [revertingSha, setRevertingSha] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<RevertOutcome | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/history")
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        if (data.ok) setCommits(data.commits);
        else setLoadError(data.error);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRevert(sha: string) {
    setRevertingSha(sha);
    setOutcome(null);
    try {
      const response = await fetch("/api/history/revert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sha }),
      });
      const data = await response.json();
      setOutcome({
        sha,
        ok: data.ok,
        message: data.ok ? "Reverted — this is now the latest commit." : data.error,
      });
    } catch (error) {
      setOutcome({
        sha,
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setRevertingSha(null);
    }
  }

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-rose-400">
        Couldn&rsquo;t load history: {loadError}
      </div>
    );
  }

  if (!commits) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        Loading history…
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <p className="mx-auto mb-6 max-w-3xl text-sm text-slate-300">
        Recent commits to the architecture data. Revert restores those files to their
        state as of that commit, as a new commit on top of <code>main</code> — it never
        rewrites history.
      </p>
      <ul className="mx-auto max-w-3xl space-y-2">
        {commits.map((commit) => (
          <li
            key={commit.sha}
            className="rounded-lg border border-slate-700 bg-[#0e1626] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[14px] font-medium text-slate-100">
                  {commit.message}
                </div>
                <div className="mt-0.5 text-xs text-slate-400">
                  {commit.authorName}
                  {commit.date && ` · ${new Date(commit.date).toLocaleString()}`} ·{" "}
                  <a
                    href={commit.htmlUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-400 hover:underline"
                  >
                    {commit.sha.slice(0, 8)}
                  </a>
                </div>
              </div>
              <button
                onClick={() => handleRevert(commit.sha)}
                disabled={revertingSha === commit.sha}
                className="shrink-0 rounded-md bg-slate-800 px-3 py-1.5 text-[13px] font-medium text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {revertingSha === commit.sha ? "Reverting…" : "Revert"}
              </button>
            </div>
            {outcome?.sha === commit.sha && (
              <div
                className={`mt-2 text-[13px] ${outcome.ok ? "text-emerald-400" : "text-rose-400"}`}
              >
                {outcome.message}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
