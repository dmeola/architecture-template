---
name: update-architecture-model
description: Add or update systems, data stores, external services, flows, or migrations in the Architecture Explorer's curated model (src/data/) and its config vocabulary (src/config/). Use when the user says the architecture changed, a system was added/retired/migrated, a new integration or data flow exists, or asks to update the architecture map/diagram.
---

# Update the architecture model

The model is hand-curated TypeScript in `src/data/` (`systems.ts`, `datastores.ts`, `externals.ts`, `flows.ts`, `migrations.ts`, shared `types.ts`). The categorical vocabulary (tiers, statuses, flow kinds, domains) and branding live in `src/config/`. Views render it directly; there is no database or API. Full reference: [docs/data-model.md](../../../docs/data-model.md).

## Rules that prevent silent breakage

1. **Node ids are unvalidated references.** Flows and migrations point at node ids as plain strings; a typo silently drops the edge from every view instead of erroring. Copy ids from the actual arrays, and grep `src/data/` + `src/config/` before renaming one.
2. **Swimlanes derive from tiers/kinds.** `src/config/landscape.ts` lanes resolve membership by a system's `tier` (or node kind), so a new system in an existing tier appears automatically. Only custom `{ ids }` lanes need manual updates.
3. **Integration Map groups do NOT derive.** `src/config/integration-map.ts` lists node ids explicitly, with no catch-all, so a new node must be added to a group's `members` or it renders nowhere on the landing view. Its *edges* are derived from `flows.ts` — never hand-author topology there; `EDGE_LABELS` only renames an aggregated label.
4. **New vocabulary is a one-line edit.** A new `Domain`, `Tier`, `FlowKind`, or status is one entry (with a color) in the relevant array in `src/config/taxonomy.ts` — the union type, theme colors/labels, and legend all derive from it. Run `npx tsc --noEmit` to confirm.

## Workflow

1. Verify the facts. Base architecture facts on the client's real systems (repos, docs, or the user). Don't invent stacks, endpoints, or flow directions. (The bundled data is an illustrative sample.)
2. Edit the data file(s):
   - New system → `systems.ts` (+ its flows; touch `src/config/landscape.ts` only for a new tier or a custom `{ ids }` lane).
   - New store/external → `datastores.ts` / `externals.ts`.
   - **Any new node** → also add its id to a group's `members` in `src/config/integration-map.ts`.
   - New connection → `flows.ts`: id like `"<source>-to-<target>"`, short `label` (renders on the edge), `description` for detail, tag all relevant `domains`. Use `planned: true` for not-yet-built flows (dashed) and `step: n` only for edges in a sequenced trace.
   - Migration progress → `migrations.ts` (`status`: planned → in-progress → near-complete → complete).
3. Status changes ripple: when a migration completes, also update the involved systems' `status` (e.g. `migrating-out` → `deprecated`, `migrating-in` → `production`) and un-`planned` the new flows.
4. Verify: `npx tsc --noEmit`, then check the affected views in the dev server (node in its lane **and its Integration Map group**, edges under the right domain filters, DetailPanel reads correctly). The browser console warns about anything the Integration Map left ungrouped.
