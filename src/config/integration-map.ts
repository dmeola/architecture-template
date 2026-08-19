/**
 * The Integration Map — a hub-and-spoke system landscape diagram, and the app's landing
 * view.
 *
 * This is a HIGHER ALTITUDE view than the System Landscape. Where the landscape shows every
 * node individually in swimlanes, this collapses the model into a dozen boxes arranged
 * around the commerce platform as the hub, with the integration layer as a bus band beneath
 * it — the idiom commerce stack diagrams use.
 *
 * The vertical axis is free to carry meaning. In this demo model it carries the cutover:
 * the modern estate above the bus, the legacy estate below, and the integration layer as
 * the band between them that both eras cross.
 *
 * Two things stay derived from the model rather than restated here, so the map cannot drift
 * out of sync:
 *
 *  - **Edges.** Any flow between a member of group A and a member of group B produces an
 *    A → B edge. The label is built from the distinct underlying flow labels.
 *  - **Phase.** Members filter by the Current/Target toggle, and a group with no surviving
 *    members disappears rather than rendering empty.
 *
 * What IS stated here is grouping and position — the editorial judgement a hub-and-spoke
 * diagram exists to express. Auto-layout (dagre) deliberately isn't used: it produces a
 * layered DAG, which is the thing this view is meant to be an alternative to.
 *
 * Every node should belong to exactly one group. An ungrouped node silently vanishes from
 * the landing page, so `IntegrationMapView` logs a dev-only console warning naming anything
 * missing or double-counted.
 *
 * **Standing this up for a client**: replace `mapGroups` wholesale. Pick the hub (whatever
 * everything talks to), pick the bus (whatever every integration crosses), cluster the rest
 * by the role they play in that client's story, then position the boxes on the three-column
 * spine below. Nothing else in the view needs editing except `SPINE_GROUPS` in
 * `src/views/IntegrationMapView.tsx`, which names the hub and bus group ids.
 */

export type GroupRole = "hub" | "bus" | "cluster";

export interface MapGroup {
  id: string;
  title: string;
  /** Optional line under the title — used to name what the box actually is. */
  subtitle?: string;
  /** Model node ids collapsed into this box. */
  members: string[];
  /** Top-left position and width on the map canvas, in pixels. */
  x: number;
  y: number;
  width: number;
  /** `hub` and `bus` get distinct visual treatment; everything else is a cluster. */
  role?: GroupRole;
  /** Border/heading accent. Defaults to slate. */
  accent?: string;
  /** Path under `public/` to a logo rendered in the box header. */
  logo?: string;
  /** Chip columns inside the box. Defaults to 2. */
  columns?: number;
}

/**
 * Label overrides for derived edges, keyed `"<sourceGroup>->:<targetGroup>"`.
 *
 * Derivation concatenates the distinct flow labels, which is right for a thin edge and
 * noisy for a thick one — the commerce ↔ integration edge alone aggregates several flows.
 * Where that happens, name the traffic instead of listing it.
 */
export const EDGE_LABELS: Record<string, string> = {
  "back-office->data-stores": "Products · Orders · Media · Index · ETL",
  "integration->back-office": "Products · Orders · Inventory · Events",
  "integration->commerce": "Catalog · Inventory · Order status",
  "supply->integration": "Vendor feeds · Stock · Shipments · POs",
};

/**
 * Layout is a three-column spine: channels and the commerce platform down the middle,
 * satellites left and right, and the integration layer spanning the full width so that
 * everything visibly crosses it. Heights are computed from member count at render time, so
 * only x/y/width live here.
 *
 * Accents mostly reuse the tier and node-kind colors from `taxonomy.ts`, so a box here reads
 * as the same thing it reads as in the Landscape legend — but `accent` is a free choice, and
 * the bus takes its own color because "bus" is a role in this diagram rather than a tier.
 * The third-party clusters deliberately share the external slate: "these are the given, not
 * the decision" is the signal, and separate colors would imply separate kinds of thing.
 */
export const mapGroups: MapGroup[] = [
  {
    id: "experience",
    title: "Experience Layer",
    subtitle: "Headless channel · BFF",
    members: ["headless-storefront", "storefront-bff", "search-service"],
    x: 705,
    y: 0,
    width: 330,
    accent: "#a78bfa",
  },
  {
    id: "platform",
    title: "Platform & Analytics",
    members: ["cdn", "monitoring", "analytics-saas"],
    x: 250,
    y: 210,
    width: 300,
    accent: "#94a3b8",
  },
  {
    id: "commerce",
    title: "Commerce Platform",
    subtitle: "Online store · checkout",
    members: ["shopify-online-store", "shopify-checkout"],
    x: 680,
    y: 210,
    width: 380,
    role: "hub",
    accent: "#38bdf8",
    columns: 1,
  },
  {
    id: "payments",
    title: "Payments & Tax",
    members: ["payment-gateway", "tax-service"],
    x: 1190,
    y: 210,
    width: 300,
    accent: "#94a3b8",
  },
  {
    id: "marketing",
    title: "Marketing & Customer Data",
    members: ["email-marketing", "cdp"],
    x: 250,
    y: 470,
    width: 300,
    accent: "#94a3b8",
  },
  {
    id: "supply",
    title: "Supply & Logistics",
    members: ["supplier-edi", "threepl", "shipping-service", "erp"],
    x: 1190,
    y: 470,
    width: 300,
    accent: "#94a3b8",
  },
  {
    id: "integration",
    title: "Integration Layer",
    subtitle: "Every integration crosses here",
    members: ["ipaas", "event-bus"],
    x: 250,
    y: 700,
    width: 1240,
    role: "bus",
    accent: "#e879f9",
    columns: 2,
  },
  {
    id: "legacy",
    title: "Legacy",
    subtitle: "Retires at cutover",
    members: ["legacy-magento", "legacy-oms"],
    x: 250,
    y: 880,
    width: 300,
    accent: "#f59e0b",
  },
  {
    id: "back-office",
    title: "Back Office",
    subtitle: "Systems of record — retained",
    members: ["oms", "pim", "admin-console", "analytics-service"],
    x: 705,
    y: 880,
    width: 330,
    accent: "#34d399",
  },
  {
    id: "data-stores",
    title: "Data Stores",
    members: [
      "oms-db",
      "pim-db",
      "warehouse",
      "cache",
      "object-storage",
      "search-index",
    ],
    x: 1190,
    y: 880,
    width: 300,
    accent: "#22d3ee",
  },
];
