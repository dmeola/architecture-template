"use client";

/* eslint-disable @next/next/no-img-element */

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { ArchNodeDef } from "@/data/types";
import type { MapGroup } from "@/config/integration-map";
import { statusColors, statusLabels } from "@/lib/theme";

/** Box sides, each of which gets paired source/target handles. */
export const HANDLE_SIDES = [
  ["top", Position.Top],
  ["bottom", Position.Bottom],
  ["left", Position.Left],
  ["right", Position.Right],
] as const;

/**
 * Two lanes per side, offset either side of center.
 *
 * A pair of groups that talk both ways picks the same facing sides for both directions, so
 * without this the two edges trace the same line and stack their labels into an unreadable
 * smudge. `IntegrationMapView` routes the reverse direction down lane `b`, and the pair
 * runs parallel with a real gap between the labels.
 */
export const HANDLE_LANES = [
  ["", "28%"],
  ["-b", "72%"],
] as const;

const PAD = 12;
const HEADER_H = 26;
const SUBTITLE_H = 15;
const LOGO_H = 40;
const CHIP_H = 26;
const CHIP_GAP = 6;

/**
 * Height of a group box, given how many members survive the phase filter.
 *
 * Exported because the view needs it to lay out and the node needs it to render, and the
 * two disagreeing would leave boxes overlapping or floating. Single source of truth.
 */
export function groupHeight(group: MapGroup, memberCount: number): number {
  const columns = group.columns ?? 2;
  const rows = Math.max(1, Math.ceil(memberCount / columns));
  return (
    PAD * 2 +
    HEADER_H +
    (group.subtitle ? SUBTITLE_H : 0) +
    (group.logo ? LOGO_H : 0) +
    rows * CHIP_H +
    (rows - 1) * CHIP_GAP
  );
}

export type MapGroupFlowNode = Node<
  {
    group: MapGroup;
    members: ArchNodeDef[];
    dimmed: boolean;
    selectedId: string | null;
    onSelectMember: (id: string) => void;
  },
  "mapGroup"
>;

function memberStatus(def: ArchNodeDef): { color: string; label: string } | null {
  if (def.kind !== "system") return null;
  return { color: statusColors[def.status], label: statusLabels[def.status] };
}

export function MapGroupNode({ data }: NodeProps<MapGroupFlowNode>) {
  const { group, members, dimmed, selectedId, onSelectMember } = data;
  const accent = group.accent ?? "#94a3b8";
  const isHub = group.role === "hub";
  const isBus = group.role === "bus";
  const columns = group.columns ?? 2;

  return (
    <div
      className="rounded-xl transition-opacity duration-150"
      style={{
        width: group.width,
        height: groupHeight(group, members.length),
        padding: PAD,
        // Hub and bus get a wash of their own accent rather than a fixed tint, so the
        // component stays client-agnostic — the accent is the only color decision, and
        // a hardcoded tint would clash the moment a client picks a different one.
        background:
          isHub || isBus
            ? `linear-gradient(0deg, ${accent}26, ${accent}26), rgb(10, 15, 26)`
            : "rgba(15, 23, 42, 0.72)",
        border: `${isHub || isBus ? 2 : 1}px solid ${accent}${isHub || isBus ? "" : "66"}`,
        boxShadow: isHub
          ? `0 0 0 1px ${accent}33, 0 8px 30px -12px ${accent}88`
          : undefined,
        opacity: dimmed ? 0.25 : 1,
      }}
    >
      {/* Every side carries source and target handles in two lanes, so the view can pick
          the pair facing the other box (see `sideFor()` in IntegrationMapView) and split a
          two-way pair across lanes. With a single unnamed handle per type, React Flow would
          route every edge through the same side and the hub would grow a fan of crossing
          lines. Hidden because sixteen visible dots per box would clutter a diagram whose
          whole point is legibility at a glance. */}
      {HANDLE_SIDES.map(([side, position]) =>
        HANDLE_LANES.map(([lane, at]) => {
          const along =
            position === Position.Top || position === Position.Bottom
              ? { left: at }
              : { top: at };
          return (
            <span key={`${side}${lane}`}>
              <Handle
                type="target"
                id={`${side}-in${lane}`}
                position={position}
                style={along}
                className="!opacity-0"
              />
              <Handle
                type="source"
                id={`${side}-out${lane}`}
                position={position}
                style={along}
                className="!opacity-0"
              />
            </span>
          );
        }),
      )}

      <div
        className="flex items-baseline justify-between gap-2"
        style={{ height: HEADER_H }}
      >
        <span
          className={`font-semibold uppercase tracking-[0.14em] ${
            isHub ? "text-[15px]" : "text-[12px]"
          }`}
          style={{ color: accent }}
        >
          {group.title}
        </span>
        <span className="shrink-0 text-[11px] tabular-nums text-slate-500">
          {members.length}
        </span>
      </div>

      {group.subtitle && (
        <div
          className="truncate text-[11px] text-slate-400"
          style={{ height: SUBTITLE_H }}
        >
          {group.subtitle}
        </div>
      )}

      {group.logo && (
        <div className="flex items-center" style={{ height: LOGO_H }}>
          <img
            src={group.logo}
            alt=""
            className="h-7 w-auto opacity-95"
            draggable={false}
          />
        </div>
      )}

      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: CHIP_GAP,
        }}
      >
        {members.map((def) => {
          const status = memberStatus(def);
          const selected = def.id === selectedId;
          return (
            <button
              key={def.id}
              type="button"
              title={def.name}
              onClick={(event) => {
                // Without this the click bubbles to React Flow's node handler, which
                // would select the group instead of the member the user aimed at.
                event.stopPropagation();
                onSelectMember(def.id);
              }}
              className="flex items-center gap-1.5 truncate rounded-md px-2 text-left text-[11.5px] transition-colors"
              style={{
                height: CHIP_H,
                background: selected ? `${accent}2e` : "rgba(148, 163, 184, 0.09)",
                border: `1px solid ${selected ? accent : "transparent"}`,
                color: selected ? "#f1f5f9" : "#cbd5e1",
              }}
            >
              {status && (
                <span
                  className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: status.color }}
                  title={status.label}
                />
              )}
              <span className="truncate">{def.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
