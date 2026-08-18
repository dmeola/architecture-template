"use client";

import { useState } from "react";
import { NODE_KIND_VISUALS, SYSTEM_STATUSES, TIERS } from "@/config/taxonomy";

// Node categories = one swatch per tier, plus the two fixed node kinds (datastore/external).
const categories = [
  ...TIERS.map((tier) => ({ label: tier.label, color: tier.accent })),
  ...Object.values(NODE_KIND_VISUALS).map((visual) => ({
    label: visual.label,
    color: visual.accent,
  })),
];

export function Legend() {
  const [open, setOpen] = useState(false);

  return (
    <div className="pointer-events-auto absolute bottom-4 right-4 z-40">
      {open ? (
        <div className="w-72 rounded-lg border border-slate-700 bg-[#0e1626]/95 p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-slate-200">Legend</span>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-slate-200"
              aria-label="Close legend"
            >
              ✕
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
            {categories.map((category) => (
              <div key={category.label} className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ background: category.color }}
                />
                <span className="text-xs text-slate-300">{category.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-slate-800 pt-3">
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {SYSTEM_STATUSES.map((status) => (
                <div key={status.id} className="flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: status.color }}
                  />
                  <span className="text-xs text-slate-300">{status.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 space-y-1 border-t border-slate-800 pt-3 text-xs text-slate-400">
            <div>Solid arrows: active flows · dashed: planned</div>
            <div>Hover a node to isolate its connections</div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="rounded-md border border-slate-600 bg-[#0e1626]/95 px-3 py-1.5 text-[13px] text-slate-300 shadow-lg transition-colors hover:text-slate-100"
        >
          Legend
        </button>
      )}
    </div>
  );
}
