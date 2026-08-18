"use client";

import { useMemo } from "react";
import type { ArchNodeDef, SequenceDef } from "@/data/types";
import { useModel } from "@/lib/model/ModelContext";
import { domainColors, flowKindLabels, nodeVisual } from "@/lib/theme";

interface SequenceDiagramProps {
  sequence: SequenceDef;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

// ── Geometry (all in px) ───────────────────────────────────────────
const PAD = 28;
const BOX_W = 180;
const BOX_H = 66;
const COL_W = 228; // distance between adjacent lifeline centers
const HEADER_TOP = 24;
const FIRST_MSG_GAP = 44; // header bottom → first message
const ROW_H = 72;
const SELF_LOOP_W = 46;
const SELF_LOOP_H = 26;
const SELF_EXTRA = 28; // extra row height a self-message needs
const ACT_W = 8; // activation-bar width
const ACT_MIN = 18; // stub height when a call has no matching return

// ── Note sizing ────────────────────────────────────────────────────
// Notes are the one variable-height element, so their row allowance is estimated from
// the text rather than fixed: a long note wraps to multiple lines, and a constant would
// either overrun the next message row or leave a gap under every short note.
const NOTE_W = 248; // outer width of the rendered note, padding included
const NOTE_PAD_X = 12; // px-1.5 either side
const NOTE_LINE_H = 15; // 12px text at leading-tight
const NOTE_PAD_Y = 12; // py-0.5 either side, plus clearance to the next row
// Effective advance per character, not the mean glyph width: word wrapping leaves every
// line ragged, so the usable characters per line run well below width/glyph-width.
// Erring high costs a few px of gap; erring low overlaps the next row.
const NOTE_CHAR_W = 7;

function noteHeight(note: string | undefined): number {
  if (!note) return 0;
  const perLine = Math.floor((NOTE_W - NOTE_PAD_X) / NOTE_CHAR_W);
  return Math.ceil(note.length / perLine) * NOTE_LINE_H + NOTE_PAD_Y;
}

/** Neutral look for diagram-only actors (not architecture nodes). */
const ACTOR_VISUAL = { accent: "#94a3b8", bg: "#1e242d", categoryLabel: "Actor" };

function visualFor(id: string, nodeById: Map<string, ArchNodeDef>) {
  const def = nodeById.get(id);
  return def ? nodeVisual(def) : ACTOR_VISUAL;
}

export function SequenceDiagram({
  sequence,
  selectedId,
  onSelect,
}: SequenceDiagramProps) {
  const { isArchNode, nodeById, participantLabel } = useModel();
  const color = domainColors[sequence.domain];

  const layout = useMemo(() => {
    const { participants, messages } = sequence;
    const indexOf = new Map(participants.map((id, i) => [id, i]));
    const cx = (i: number) => PAD + BOX_W / 2 + i * COL_W;

    const lifelineTop = HEADER_TOP + BOX_H;
    const messagesTop = lifelineTop + FIRST_MSG_GAP;

    // Assign a y to each message, growing the canvas for self-loops and notes.
    // Cumulative offsets are summed functionally (no mutable accumulator during render).
    const rowHeight = (m: SequenceDef["messages"][number]) =>
      (m.from === m.to ? ROW_H + SELF_EXTRA : ROW_H) + noteHeight(m.note);
    const rows = messages.map((m, i) => ({
      m,
      self: m.from === m.to,
      y: messagesTop + messages.slice(0, i).reduce((sum, prev) => sum + rowHeight(prev), 0),
    }));

    const lifelineBottom =
      messagesTop + messages.reduce((sum, m) => sum + rowHeight(m), 0) + 8;
    const width = PAD * 2 + BOX_W + Math.max(0, participants.length - 1) * COL_W;
    const height = lifelineBottom + PAD;

    // Pair each call with the nearest later return (response) back to the caller so we
    // can draw a callee activation bar; otherwise draw a short stub.
    const consumed = new Set<number>();
    const activations = rows.flatMap((row, i) => {
      const { m } = row;
      if (m.response || row.self) return [];
      const toIdx = indexOf.get(m.to);
      if (toIdx == null) return [];
      let end = row.y + ACT_MIN;
      for (let j = i + 1; j < rows.length; j++) {
        if (consumed.has(j)) continue;
        const rm = rows[j].m;
        if (rm.response && rm.from === m.to && rm.to === m.from) {
          end = rows[j].y;
          consumed.add(j);
          break;
        }
      }
      return [{ x: cx(toIdx), y1: row.y, y2: Math.max(end, row.y + ACT_MIN) }];
    });

    return { participants, rows, indexOf, cx, lifelineTop, lifelineBottom, width, height, activations };
  }, [sequence]);

  const { participants, rows, indexOf, cx, lifelineTop, lifelineBottom, width, height, activations } =
    layout;
  const arrowId = `seq-arrow-${sequence.id}`;

  return (
    <div className="relative" style={{ width, height }}>
      {/* Geometry layer: lifelines, activation bars, arrows */}
      <svg
        width={width}
        height={height}
        className="absolute inset-0"
        aria-hidden="true"
      >
        <defs>
          <marker
            id={arrowId}
            viewBox="0 0 10 10"
            refX="8.5"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill={color} />
          </marker>
        </defs>

        {/* Lifelines */}
        {participants.map((id, i) => (
          <line
            key={id}
            x1={cx(i)}
            y1={lifelineTop}
            x2={cx(i)}
            y2={lifelineBottom}
            stroke="#5a6b85"
            strokeWidth={1}
            strokeDasharray="3 4"
          />
        ))}

        {/* Activation bars */}
        {activations.map((a, i) => (
          <rect
            key={i}
            x={a.x - ACT_W / 2}
            y={a.y1}
            width={ACT_W}
            height={a.y2 - a.y1}
            rx={2}
            fill={`${color}26`}
            stroke={`${color}80`}
            strokeWidth={1}
          />
        ))}

        {/* Message arrows */}
        {rows.map((row, i) => {
          const { m, self } = row;
          const fromIdx = indexOf.get(m.from);
          const toIdx = indexOf.get(m.to);
          if (fromIdx == null || toIdx == null) return null;
          const dashed = m.response || m.planned;
          const strokeProps = {
            stroke: color,
            strokeWidth: 1.5,
            strokeDasharray: dashed ? "5 4" : undefined,
            opacity: m.response ? 0.85 : 1,
            markerEnd: `url(#${arrowId})`,
            fill: "none" as const,
          };

          if (self) {
            const x = cx(fromIdx);
            return (
              <path
                key={i}
                d={`M ${x} ${row.y} h ${SELF_LOOP_W} v ${SELF_LOOP_H} h ${-SELF_LOOP_W}`}
                {...strokeProps}
              />
            );
          }

          const x1 = cx(fromIdx);
          const x2 = cx(toIdx);
          const dir = Math.sign(x2 - x1) || 1;
          return (
            <line
              key={i}
              x1={x1 + dir * 4}
              y1={row.y}
              x2={x2 - dir * 4}
              y2={row.y}
              {...strokeProps}
            />
          );
        })}
      </svg>

      {/* Participant headers */}
      {participants.map((id, i) => {
        const visual = visualFor(id, nodeById);
        const clickable = isArchNode(id);
        const selected = selectedId === id;
        // Longhand border props only — mixing the `borderTop` shorthand with `borderColor`
        // makes React warn about conflicting top-border color on re-render (selection).
        const sideColor = selected ? visual.accent : `${visual.accent}66`;
        const style: React.CSSProperties = {
          left: cx(i) - BOX_W / 2,
          top: HEADER_TOP,
          width: BOX_W,
          height: BOX_H,
          background: visual.bg,
          borderStyle: "solid",
          borderTopWidth: 3,
          borderRightWidth: 1,
          borderBottomWidth: 1,
          borderLeftWidth: 1,
          borderTopColor: visual.accent,
          borderRightColor: sideColor,
          borderBottomColor: sideColor,
          borderLeftColor: sideColor,
          boxShadow: selected ? `0 0 0 1px ${visual.accent}` : undefined,
        };
        const content = (
          <>
            <div
              className="truncate text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: visual.accent }}
            >
              {visual.categoryLabel}
            </div>
            <div className="mt-0.5 line-clamp-2 text-[13px] font-medium leading-tight text-slate-100">
              {participantLabel(id)}
            </div>
          </>
        );
        return clickable ? (
          <button
            key={id}
            onClick={() => onSelect(id)}
            title={`${participantLabel(id)} — open details`}
            className="absolute overflow-hidden rounded-md px-2 py-1 text-left transition-opacity hover:opacity-85"
            style={style}
          >
            {content}
          </button>
        ) : (
          <div
            key={id}
            className="absolute overflow-hidden rounded-md px-2 py-1"
            style={style}
          >
            {content}
          </div>
        );
      })}

      {/* Message labels + notes */}
      {rows.map((row, i) => {
        const { m, self } = row;
        const fromIdx = indexOf.get(m.from);
        const toIdx = indexOf.get(m.to);
        if (fromIdx == null || toIdx == null) return null;

        const labelStyle: React.CSSProperties = self
          ? {
              left: cx(fromIdx) + SELF_LOOP_W + 10,
              top: row.y + SELF_LOOP_H / 2,
              transform: "translateY(-50%)",
              maxWidth: COL_W,
            }
          : {
              left: (cx(fromIdx) + cx(toIdx)) / 2,
              top: row.y - 11,
              transform: "translate(-50%, -100%)",
              maxWidth: 208,
            };

        return (
          <div key={i}>
            <div
              className="absolute flex flex-col items-center gap-0.5 rounded bg-[#0e1626]/90 px-1.5 py-0.5 text-center"
              style={labelStyle}
            >
              {m.kind !== "api-call" && (
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {flowKindLabels[m.kind]}
                </span>
              )}
              <span className="text-[13px] leading-tight text-slate-200">
                {m.label}
              </span>
            </div>
            {m.note && (
              <div
                className="absolute rounded bg-[#0e1626]/90 px-1.5 py-0.5 text-center text-xs italic leading-tight text-slate-400"
                style={{
                  // Width is driven by NOTE_W rather than a utility class so the wrap
                  // matches the height `noteHeight()` reserved for this row.
                  maxWidth: NOTE_W,
                  left: (cx(fromIdx) + cx(toIdx)) / 2,
                  top: row.y + 7,
                  transform: "translateX(-50%)",
                }}
              >
                {m.note}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
