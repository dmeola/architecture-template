"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  MarkerType,
  ReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { EDGE_LABELS, mapGroups, type MapGroup } from "@/config/integration-map";
import { matchesPhase, type Phase } from "@/data/model";
import type { ArchNodeDef } from "@/data/types";
import { useModel } from "@/lib/model/ModelContext";
import { groupHeight, MapGroupNode, type MapGroupFlowNode } from "@/graph/MapGroupNode";

const nodeTypes = { mapGroup: MapGroupNode };

const NEUTRAL_EDGE = "#5a6b85";
/** Labels longer than this are truncated — an edge label is a signpost, not a manifest. */
const MAX_EDGE_LABELS = 3;
/**
 * The spine: the hub and the bus. Everything is expected to cross one of them, so edges
 * touching either are always labelled regardless of weight.
 *
 * These are `mapGroups` ids — update them alongside the groups when standing up a client.
 */
const SPINE_GROUPS = new Set(["commerce", "integration"]);
/**
 * Minimum aggregated flows before a non-spine edge earns a permanent label.
 *
 * Labelling every edge at once is unreadable on a real client model — in the Both phase the
 * current and target estates are drawn on top of each other. Thin edges keep their label on
 * hover instead, so nothing is lost, it just isn't all shouted at once.
 */
const LABEL_THRESHOLD = 3;

interface Box {
  group: MapGroup;
  members: ArchNodeDef[];
  cx: number;
  cy: number;
}

/**
 * Which sides of two boxes face each other.
 *
 * Picks the dominant axis between their centers, so a box directly below the hub connects
 * bottom→top rather than looping around the side.
 */
function sideFor(from: Box, to: Box): { source: string; target: string } {
  const dx = to.cx - from.cx;
  const dy = to.cy - from.cy;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0
      ? { source: "right-out", target: "left-in" }
      : { source: "left-out", target: "right-in" };
  }
  return dy > 0
    ? { source: "bottom-out", target: "top-in" }
    : { source: "top-out", target: "bottom-in" };
}

interface IntegrationMapViewProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  phase: Phase;
}

export function IntegrationMapView({
  selectedId,
  onSelect,
  phase,
}: IntegrationMapViewProps) {
  const { flows, allNodes, nodeById, nodePhase, flowPhase } = useModel();
  const [hoverGroup, setHoverGroup] = useState<string | null>(null);

  useCoverageWarning(allNodes);

  const { boxes, groupOfNode } = useMemo(() => {
    const groupOfNode = new Map<string, string>();
    for (const group of mapGroups) {
      for (const id of group.members) groupOfNode.set(id, group.id);
    }
    // A group whose members are all filtered out disappears rather than rendering as an
    // empty labelled box — in the Current view that correctly removes a target-only group.
    const boxes: Box[] = [];
    for (const group of mapGroups) {
      const members = group.members
        .map((id) => nodeById.get(id))
        .filter((def): def is ArchNodeDef => Boolean(def))
        .filter((def) => matchesPhase(nodePhase(def), phase));
      if (members.length === 0) continue;
      const height = groupHeight(group, members.length);
      boxes.push({
        group,
        members,
        cx: group.x + group.width / 2,
        cy: group.y + height / 2,
      });
    }
    return { boxes, groupOfNode };
  }, [phase, nodeById, nodePhase]);

  const boxById = useMemo(
    () => new Map(boxes.map((box) => [box.group.id, box])),
    [boxes],
  );

  /**
   * Edges are DERIVED: any flow crossing a group boundary produces one group-to-group
   * edge, carrying the distinct labels of the flows it aggregates. Nothing about the
   * topology is restated in config, so adding a flow to the model updates this map too.
   */
  const edges: Edge[] = useMemo(() => {
    const aggregated = new Map<
      string,
      {
        source: string;
        target: string;
        labels: Set<string>;
        allPlanned: boolean;
        /** How many model flows this one edge stands for — drives stroke weight. */
        count: number;
      }
    >();

    for (const flow of flows) {
      if (!matchesPhase(flowPhase(flow), phase)) continue;
      const source = groupOfNode.get(flow.source);
      const target = groupOfNode.get(flow.target);
      if (!source || !target || source === target) continue;
      if (!boxById.has(source) || !boxById.has(target)) continue;

      const key = `${source}->${target}`;
      const entry = aggregated.get(key);
      if (entry) {
        entry.labels.add(flow.label);
        entry.allPlanned = entry.allPlanned && Boolean(flow.planned);
        entry.count += 1;
      } else {
        aggregated.set(key, {
          source,
          target,
          labels: new Set([flow.label]),
          allPlanned: Boolean(flow.planned),
          count: 1,
        });
      }
    }

    return [...aggregated.entries()].map(([key, entry]) => {
      const from = boxById.get(entry.source)!;
      const to = boxById.get(entry.target)!;
      const { source: sourceHandle, target: targetHandle } = sideFor(from, to);
      // Both directions of a two-way pair face the same sides, so they would trace the
      // same line and stack their labels. Send one of them down the second handle lane —
      // the id comparison just needs to pick a different direction each time.
      const lane =
        aggregated.has(`${entry.target}->${entry.source}`) && entry.source > entry.target
          ? "-b"
          : "";
      const labels = [...entry.labels];
      const text =
        EDGE_LABELS[key] ??
        labels.slice(0, MAX_EDGE_LABELS).join(" · ") +
          (labels.length > MAX_EDGE_LABELS ? ` +${labels.length - MAX_EDGE_LABELS}` : "");
      const touched = entry.source === hoverGroup || entry.target === hoverGroup;
      const inFocus = !hoverGroup || touched;
      const onSpine =
        SPINE_GROUPS.has(entry.source) || SPINE_GROUPS.has(entry.target);
      // Spine and heavy edges are always labelled; thin peripheral ones only when the
      // user hovers one of their endpoints.
      const label =
        touched || (!hoverGroup && (onSpine || entry.count >= LABEL_THRESHOLD))
          ? text
          : undefined;
      // Weight communicates how much actually crosses this boundary — a back-office →
      // data stores edge may stand for a dozen flows, a peripheral one for a single flow.
      const weight = Math.min(4, 1.2 + entry.count * 0.32);

      return {
        id: key,
        source: entry.source,
        target: entry.target,
        sourceHandle: `${sourceHandle}${lane}`,
        targetHandle: `${targetHandle}${lane}`,
        type: "smoothstep",
        label,
        style: {
          stroke: touched ? "#93a5be" : NEUTRAL_EDGE,
          strokeWidth: touched ? weight + 0.8 : weight,
          strokeDasharray: entry.allPlanned ? "6 4" : undefined,
          opacity: inFocus ? 1 : 0.07,
        },
        labelStyle: { fill: inFocus ? "#cbd5e1" : "#475569", fontSize: 11 },
        labelBgStyle: { fill: "#0b1220", fillOpacity: 0.94 },
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 4,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: touched ? "#93a5be" : NEUTRAL_EDGE,
          width: 14,
          height: 14,
        },
      } satisfies Edge;
    });
  }, [flows, phase, flowPhase, groupOfNode, boxById, hoverGroup]);

  const handleSelectMember = useCallback((id: string) => onSelect(id), [onSelect]);

  const nodes: Node[] = useMemo(
    () =>
      boxes.map((box) => {
        const height = groupHeight(box.group, box.members.length);
        return {
          id: box.group.id,
          type: "mapGroup",
          position: { x: box.group.x, y: box.group.y },
          // React Flow needs the bounds to route edges before the DOM is measured;
          // without these the first paint routes every edge from {0,0}.
          width: box.group.width,
          height,
          style: { width: box.group.width, height },
          draggable: false,
          selectable: false,
          data: {
            group: box.group,
            members: box.members,
            dimmed: hoverGroup ? hoverGroup !== box.group.id && !isNeighbor(box.group.id, hoverGroup, edges) : false,
            selectedId,
            onSelectMember: handleSelectMember,
          },
        } satisfies MapGroupFlowNode;
      }),
    [boxes, hoverGroup, edges, selectedId, handleSelectMember],
  );

  const handleNodeEnter: NodeMouseHandler = useCallback(
    (_event, node) => setHoverGroup(node.id),
    [],
  );

  return (
    <ReactFlow
      key={phase}
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      colorMode="dark"
      fitView
      fitViewOptions={{ padding: 0.08, maxZoom: 1 }}
      minZoom={0.15}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
      nodesDraggable={false}
      nodesConnectable={false}
      edgesFocusable={false}
      onNodeMouseEnter={handleNodeEnter}
      onNodeMouseLeave={() => setHoverGroup(null)}
      onPaneClick={() => onSelect(null)}
      className="!bg-transparent"
    >
      <Background color="#1c2637" gap={24} size={1.5} />
    </ReactFlow>
  );
}

/** True when two groups are directly connected, so hover keeps the neighborhood lit. */
function isNeighbor(groupId: string, hovered: string, edges: Edge[]): boolean {
  return edges.some(
    (edge) =>
      (edge.source === hovered && edge.target === groupId) ||
      (edge.target === hovered && edge.source === groupId),
  );
}

/**
 * Dev-only guard: a node missing from `mapGroups` renders nowhere on the landing page, and
 * a node listed twice renders twice. Neither throws, so without this the model and the map
 * drift apart silently. Compiled out of production builds.
 */
function useCoverageWarning(allNodes: ArchNodeDef[]): void {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const seen = new Set<string>();
    const duplicated = new Set<string>();
    const unknown: string[] = [];
    for (const group of mapGroups) {
      for (const id of group.members) {
        if (seen.has(id)) duplicated.add(id);
        seen.add(id);
        if (!allNodes.some((node) => node.id === id)) unknown.push(id);
      }
    }
    const ungrouped = allNodes.filter((node) => !seen.has(node.id)).map((node) => node.id);
    if (ungrouped.length)
      console.warn(`[integration-map] not in any group, so invisible here: ${ungrouped.join(", ")}`);
    if (duplicated.size)
      console.warn(`[integration-map] in more than one group: ${[...duplicated].join(", ")}`);
    if (unknown.length)
      console.warn(`[integration-map] member ids not in the model: ${unknown.join(", ")}`);
  }, [allNodes]);
}
