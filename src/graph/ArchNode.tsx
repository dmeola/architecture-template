"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { ArchNodeDef } from "@/data/types";
import { nodeVisual, statusColors, statusLabels } from "@/lib/theme";
import { NODE_WIDTH } from "./layout";

export type ArchFlowNode = Node<
  { def: ArchNodeDef; dimmed: boolean },
  "arch"
>;

function subtitle(def: ArchNodeDef): string {
  if (def.kind === "system") return def.runtime;
  if (def.kind === "datastore") return def.technology;
  return def.category;
}

export function ArchNode({ data, selected }: NodeProps<ArchFlowNode>) {
  const { def, dimmed } = data;
  const visual = nodeVisual(def);
  const isPlanned = def.kind === "system" && def.status === "planned";

  return (
    <div
      className="rounded-lg px-3 py-2 transition-opacity duration-150"
      style={{
        width: NODE_WIDTH,
        background: visual.bg,
        borderTop: `1px ${isPlanned ? "dashed" : "solid"} ${
          selected ? visual.accent : `${visual.accent}b3`
        }`,
        borderRight: `1px ${isPlanned ? "dashed" : "solid"} ${
          selected ? visual.accent : `${visual.accent}b3`
        }`,
        borderBottom: `1px ${isPlanned ? "dashed" : "solid"} ${
          selected ? visual.accent : `${visual.accent}b3`
        }`,
        borderLeft: `4px solid ${visual.accent}`,
        opacity: dimmed ? 0.18 : 1,
        boxShadow: selected ? `0 0 0 2px ${visual.accent}44` : undefined,
      }}
    >
      <Handle type="target" position={Position.Left} className="!bg-slate-500 !border-0 !w-1.5 !h-1.5" />
      <Handle type="source" position={Position.Right} className="!bg-slate-500 !border-0 !w-1.5 !h-1.5" />
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: visual.accent }}
        >
          {visual.categoryLabel}
        </span>
        {def.kind === "system" && (
          <span
            className="flex items-center gap-1 text-[11px]"
            style={{ color: statusColors[def.status] }}
            title={statusLabels[def.status]}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: statusColors[def.status] }}
            />
            {statusLabels[def.status]}
          </span>
        )}
      </div>
      <div className="mt-0.5 truncate text-[15px] font-semibold text-slate-100">
        {def.name}
      </div>
      <div className="truncate text-xs text-slate-300">{subtitle(def)}</div>
    </div>
  );
}
