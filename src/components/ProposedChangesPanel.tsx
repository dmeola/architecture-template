"use client";

import { useState } from "react";
import type { AppliedToolCall } from "@/lib/chat/deriveOps";

export type SaveResult = { ok: true; commitUrl: string } | { ok: false; error: string };

interface ProposedChangesPanelProps {
  calls: AppliedToolCall[];
  onDiscard: () => void;
  onSave: () => Promise<SaveResult>;
}

/**
 * Diff-card summary of everything the AI has proposed so far this session, derived
 * straight from the chat's own tool-call history — see `deriveAppliedToolCalls()`.
 */
export function ProposedChangesPanel({ calls, onDiscard, onSave }: ProposedChangesPanelProps) {
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<SaveResult | null>(null);

  if (calls.length === 0 && !result) return null;

  async function handleSave() {
    setSaving(true);
    setResult(null);
    setResult(await onSave());
    setSaving(false);
  }

  if (result?.ok) {
    return (
      <div className="border-t border-slate-800 px-4 py-3">
        <div className="rounded-md border border-emerald-800 bg-emerald-950/40 px-3 py-2 text-[13px] text-emerald-300">
          Saved.{" "}
          <a
            href={result.commitUrl}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            View commit
          </a>
        </div>
        <button
          onClick={() => {
            setResult(null);
            onDiscard();
          }}
          className="mt-2 w-full rounded-md bg-slate-800/70 px-3 py-1.5 text-[13px] font-medium text-slate-300 transition-colors hover:bg-slate-800"
        >
          Start a new change
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-slate-800 px-4 py-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Proposed changes ({calls.length})
        </h4>
        <button
          onClick={onDiscard}
          disabled={saving}
          className="rounded-md px-2 py-1 text-[11px] font-medium text-rose-300 transition-colors hover:bg-rose-500/10 disabled:opacity-50"
        >
          Discard
        </button>
      </div>
      <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
        {calls.map((call, i) => (
          <li
            key={i}
            className="rounded-md border border-slate-800 bg-[#111a2b] px-2.5 py-1.5 text-[12px] leading-snug text-slate-300"
          >
            {call.message}
          </li>
        ))}
      </ul>
      {result && !result.ok && (
        <div className="mt-2 rounded-md border border-rose-800 bg-rose-950/40 px-3 py-2 text-[12px] text-rose-300">
          {result.error}
        </div>
      )}
      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-2 w-full rounded-md bg-sky-500/20 px-3 py-1.5 text-[13px] font-medium text-sky-300 transition-colors hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save to GitHub"}
      </button>
    </div>
  );
}
