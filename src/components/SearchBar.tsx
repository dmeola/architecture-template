"use client";

import { useMemo, useRef, useState } from "react";
import { matchesPhase, type Phase } from "@/data/model";
import { useModel } from "@/lib/model/ModelContext";
import { nodeVisual } from "@/lib/theme";

interface SearchBarProps {
  onSelect: (id: string) => void;
  /** Hide nodes the current phase filter has removed from the graph. */
  phase?: Phase;
}

export function SearchBar({ onSelect, phase = "both" }: SearchBarProps) {
  const { allNodes, nodePhase } = useModel();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return allNodes
      .filter(
        (node) =>
          matchesPhase(nodePhase(node), phase) &&
          (node.name.toLowerCase().includes(term) ||
            node.id.toLowerCase().includes(term)),
      )
      .slice(0, 8);
  }, [query, phase, allNodes, nodePhase]);

  function pick(id: string) {
    onSelect(id);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && results.length > 0) pick(results[0].id);
          if (event.key === "Escape") setOpen(false);
        }}
        placeholder="Search systems…"
        className="w-60 rounded-md border border-slate-600 bg-[#111a2b] px-3 py-1.5 text-[13px] text-slate-200 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
      />
      {open && results.length > 0 && (
        <ul className="absolute right-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-lg border border-slate-700 bg-[#0e1626] shadow-xl">
          {results.map((node) => {
            const visual = nodeVisual(node);
            return (
              <li key={node.id}>
                <button
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(node.id)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-800/60"
                >
                  <span className="truncate text-[13px] text-slate-200">
                    {node.name}
                  </span>
                  <span
                    className="shrink-0 text-[11px] uppercase tracking-wider"
                    style={{ color: visual.accent }}
                  >
                    {visual.categoryLabel}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
