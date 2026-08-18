"use client";

import type { ArchNodeDef, FlowDef } from "@/data/types";
import { useModel } from "@/lib/model/ModelContext";
import {
  domainColors,
  domainLabels,
  flowKindLabels,
  nodeVisual,
  statusColors,
  statusLabels,
} from "@/lib/theme";

interface DetailPanelProps {
  nodeId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </h4>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function FlowRow({
  flow,
  direction,
  onSelect,
}: {
  flow: FlowDef;
  direction: "in" | "out";
  onSelect: (id: string) => void;
}) {
  const { nodeById } = useModel();
  const counterpartId = direction === "out" ? flow.target : flow.source;
  const counterpart = nodeById.get(counterpartId);
  return (
    <li className="rounded-md border border-slate-800 bg-[#111a2b] px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => onSelect(counterpartId)}
          className="truncate text-[13px] font-medium text-slate-200 hover:text-sky-300"
        >
          {direction === "out" ? "→ " : "← "}
          {counterpart?.name ?? counterpartId}
        </button>
        <span className="shrink-0 text-[11px] text-slate-400">
          {flowKindLabels[flow.kind]}
          {flow.planned ? " · planned" : ""}
        </span>
      </div>
      <div className="mt-0.5 text-xs text-slate-300">{flow.label}</div>
      {flow.description && (
        <div className="mt-1 text-xs leading-relaxed text-slate-400">
          {flow.description}
        </div>
      )}
      <div className="mt-1.5 flex flex-wrap gap-1">
        {flow.domains.map((domain) => (
          <span
            key={domain}
            className="rounded px-1.5 py-px text-[11px]"
            style={{
              color: domainColors[domain],
              background: `${domainColors[domain]}1a`,
            }}
          >
            {domainLabels[domain]}
          </span>
        ))}
      </div>
    </li>
  );
}

function SystemFacts({ def }: { def: ArchNodeDef }) {
  if (def.kind === "system") {
    return (
      <>
        <Section title="Stack">
          <ul className="space-y-0.5 text-[13px] text-slate-300">
            {def.stack.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Section>
        <Section title="Runtime">
          <div className="text-[13px] text-slate-300">{def.runtime}</div>
        </Section>
        {def.repoPath && (
          <Section title="Repo">
            <code className="break-all font-mono text-xs text-slate-300">
              {def.repoPath}
            </code>
          </Section>
        )}
        {def.url && (
          <Section title="URL">
            <a
              href={def.url}
              target="_blank"
              rel="noreferrer"
              className="text-[13px] text-sky-400 hover:underline"
            >
              {def.url}
            </a>
          </Section>
        )}
        {def.notes && def.notes.length > 0 && (
          <Section title="Notes">
            <ul className="space-y-1.5 text-[13px] leading-relaxed text-slate-300">
              {def.notes.map((note) => (
                <li key={note} className="flex gap-1.5">
                  <span className="text-slate-400">•</span>
                  {note}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </>
    );
  }
  if (def.kind === "datastore") {
    return (
      <>
        <Section title="Technology">
          <div className="text-[13px] text-slate-300">{def.technology}</div>
        </Section>
        <Section title="Contents">
          <ul className="space-y-1 text-[13px] text-slate-300">
            {def.contents.map((item) => (
              <li key={item} className="flex gap-1.5">
                <span className="text-cyan-400">•</span>
                {item}
              </li>
            ))}
          </ul>
        </Section>
      </>
    );
  }
  return (
    <Section title="Category">
      <div className="text-[13px] text-slate-300">{def.category}</div>
    </Section>
  );
}

export function DetailPanel({ nodeId, onSelect, onClose }: DetailPanelProps) {
  const { nodeById, flowsForNode } = useModel();
  const def = nodeById.get(nodeId);
  if (!def) return null;
  const visual = nodeVisual(def);
  const { incoming, outgoing } = flowsForNode(nodeId);

  return (
    <aside className="flex h-full w-96 shrink-0 flex-col border-l border-slate-800 bg-[#0c1422]">
      <div
        className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4"
        style={{ borderTop: `3px solid ${visual.accent}` }}
      >
        <div>
          <div
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: visual.accent }}
          >
            {visual.categoryLabel}
          </div>
          <h3 className="mt-0.5 text-base font-semibold text-slate-100">
            {def.name}
          </h3>
          {def.kind === "system" && (
            <span
              className="mt-1 inline-flex items-center gap-1.5 text-xs"
              style={{ color: statusColors[def.status] }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: statusColors[def.status] }}
              />
              {statusLabels[def.status]}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded-md px-2 py-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
          aria-label="Close details"
        >
          ✕
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        <p className="mt-4 text-[13px] leading-relaxed text-slate-300">
          {def.description}
        </p>
        <SystemFacts def={def} />
        {outgoing.length > 0 && (
          <Section title={`Outgoing (${outgoing.length})`}>
            <ul className="space-y-2">
              {outgoing.map((flow) => (
                <FlowRow key={flow.id} flow={flow} direction="out" onSelect={onSelect} />
              ))}
            </ul>
          </Section>
        )}
        {incoming.length > 0 && (
          <Section title={`Incoming (${incoming.length})`}>
            <ul className="space-y-2">
              {incoming.map((flow) => (
                <FlowRow key={flow.id} flow={flow} direction="in" onSelect={onSelect} />
              ))}
            </ul>
          </Section>
        )}
      </div>
    </aside>
  );
}
