<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Architecture Explorer (template)

Interactive map of a client's systems, data flows, data stores, and legacy-to-modern migrations. Next.js (App Router) + TypeScript + Tailwind 4 + React Flow (`@xyflow/react`) + dagre. The architecture knowledge is **hand-curated TypeScript data** under `src/data/`, and each client's vocabulary + branding live in `src/config/` — there is no database, no API, no scanning. Everything is bundled at build time.

This repository is a **reusable template**: a generic graph engine plus a neutral sample dataset ("Acme Outfitters", a fictional Shopify retailer with an iPaaS, OMS, and PIM). To stand up a new client, edit `src/config/` and `src/data/` — see `docs/new-client.md`.

## Commands

```bash
npm run dev          # dev server at http://localhost:3000
npm run build        # production build (also the best full type-check)
npm run lint         # eslint
npx tsc --noEmit     # type-check only
```

## Layout

| Path | Purpose |
| --- | --- |
| `src/config/` | **Per-client config** — `taxonomy.ts` (tiers/statuses/flow-kinds/domains + colors, from which the union types derive), `site.ts` (branding + defaults), `landscape.ts` (swimlanes), `integration-map.ts` (hub-and-spoke groups + positions) |
| `src/data/` | The curated model: `systems.ts`, `datastores.ts`, `externals.ts`, `flows.ts`, `migrations.ts`, shared `types.ts`, and `model.ts` (lookups/selectors) |
| `src/views/` | One client component per tab: Integration Map (landing page), Landscape, Data Flows, Data Stores, Migration Map |
| `src/graph/` | Shared React Flow engine: `FlowGraph.tsx` (nodes/edges/hover/trace), `ArchNode.tsx`, `layout.ts` (dagre), `MapGroupNode.tsx` (Integration Map group box) |
| `src/components/` | `Explorer.tsx` (view shell), `DetailPanel`, `SearchBar`, `Legend` |
| `src/lib/theme.ts` | Colors + labels for tiers/statuses/domains/flow kinds — **all derived from `src/config/taxonomy.ts`** |
| `src/proxy.ts` | Cloudflare Access JWT verification (skipped when env vars unset) |
| `docs/` | `data-model.md` (editing the model), `app-architecture.md` (how the app is built), `new-client.md` (cloning for a new client) |

## Editing the architecture model — most common task

Follow `docs/data-model.md` (or the `update-architecture-model` skill). The short version:

1. Node `id`s are referenced by `flows.ts` and `migrations.ts`. **Keep ids stable**; there is no runtime validation that a flow's `source`/`target` exists — a typo silently drops the edge from views.
2. **Adding a system/datastore/external** is usually just the data file: swimlanes derive membership from a system's `tier` (or node kind), so a new system in an existing tier appears automatically. Only custom `{ ids }` lanes in `src/config/landscape.ts` need manual updates.
3. **Adding a `Domain`, `Tier`, `FlowKind`, or status** is a one-line edit in `src/config/taxonomy.ts` — add an entry (with a color) to the relevant array. The union type, theme colors/labels, legend, and chip order all derive from it. No `theme.ts` edit needed.
4. `flows.ts`: `step` numbers the animated order-lifecycle trace (Data Flows → Orders); `planned: true` renders the edge dashed.
5. Branding (titles, header, default view/domain) lives in `src/config/site.ts`.
6. **Integration Map**: adding a node means adding it to a group in `src/config/integration-map.ts` too — an ungrouped node vanishes from the landing page, and the dev-only console warning from `IntegrationMapView` is what tells you. Edges there are derived from `flows.ts`, so don't hand-author topology; use `EDGE_LABELS` only to rename a noisy aggregated label.
7. Verify with `npx tsc --noEmit`, then eyeball the affected view in the dev server.

## Conventions

- Path alias `@/*` → `src/*`.
- Graph views are `"use client"`; keep the data model + config importable on both server and client (plain data + pure functions, no side effects).
- Dark-theme only; colors are hex values in `src/config/taxonomy.ts` (plus a few structural ones inline in the engine), not Tailwind classes, because React Flow node/edge styles are inline.
- The bundled `src/data/*` is an **illustrative sample** (a fictional Shopify retailer). When populating a real client, base facts on the client's real systems/repos or ask the user — don't invent architecture facts.

## Deployment

Vercel, behind Cloudflare Access. `src/proxy.ts` rejects requests lacking a valid `Cf-Access-Jwt-Assertion` JWT when `CF_ACCESS_TEAM_DOMAIN` + `CF_ACCESS_AUD` are set; unset (local dev) it fails open. Details in `README.md`.
