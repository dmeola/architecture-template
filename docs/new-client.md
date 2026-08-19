# Cloning this template for a new client

This repo is a template. Each client gets its own copy (one repo per client) — the graph engine stays untouched; you edit config + data.

## 1. Copy the template

```bash
cp -R architecture-template <client>-architecture
cd <client>-architecture
rm -rf .git node_modules .next
git init
npm install
npm run dev   # confirm the sample renders at http://localhost:3000
```

Set `name` in `package.json` to the client's slug.

## 2. Branding — `src/config/site.ts`

Set `name`, `headerTitle`, `headerSubtitle`, `metaTitle`, `metaDescription`, and the `defaultView` / `defaultDomain`. Replace `src/app/favicon.ico` if you have a client icon.

## 3. Vocabulary — `src/config/taxonomy.ts`

Adjust the arrays to the client's world:

- `TIERS` — the architectural layers you'll group systems into (these are also the Landscape swimlanes). Give each an `accent`, `bg`, and `label`.
- `DOMAINS` — the business domains flows belong to (Data Flows chips). Array order = chip order.
- `SYSTEM_STATUSES`, `FLOW_KINDS`, `MIGRATION_STATUSES` — usually fine as-is; edit labels/colors if the client's language differs. Leave the `SYSTEM_STATUSES` **ids** (`production`, `migrating-in`, `migrating-out`, `planned`, `deprecated`) alone if you want the Current/Target phase toggle to keep working out of the box — `nodePhase()` in `src/data/model.ts` switches on those exact ids. Renaming a label is fine; renaming an id needs a matching edit there too.

The union types, theme colors/labels, and legend all derive from these arrays automatically — no other file to touch.

## 4. Swimlanes — `src/config/landscape.ts`

The default lanes cover every tier plus data stores and externals. Reorder or retitle them, or use `{ ids: [...] }` for a custom grouping. Keep a lane for every tier and both node kinds so no node is left unplaced (unplaced nodes silently disappear from the Landscape view).

## 5. The model — `src/data/*`

Replace the sample content:

- `systems.ts`, `datastores.ts`, `externals.ts` — the nodes. Keep ids stable and kebab-case.
- `flows.ts` — the edges. Tag domains; use `step` for a sequenced trace and `planned: true` for future flows.
- `migrations.ts` — legacy → modern efforts.

Base facts on the client's real systems (repos, docs, interviews). See [data-model.md](data-model.md) for the full field reference and checklists.

## 6. Integration Map — `src/config/integration-map.ts`

The landing view: a hub-and-spoke diagram that collapses the whole model into a dozen boxes.
Do this once the nodes exist, since it groups them.

Replace `mapGroups` wholesale — pick the hub (whatever everything talks to), pick the bus
(whatever every integration crosses), cluster the rest by the role each plays in this
client's story, and lay the boxes out on the three-column spine. Then set `SPINE_GROUPS` in
`src/views/IntegrationMapView.tsx` to the hub and bus group ids.

Only grouping and position live here — edges are derived from `flows.ts`, so don't
hand-author topology. Use `EDGE_LABELS` to rename an aggregated label that has gone noisy,
never to invent an edge. Every node should sit in exactly one group; an ungrouped one
renders nowhere, and the view logs a dev-only console warning naming it.

## 7. Verify

```bash
npx tsc --noEmit
npm run build
npm run dev
```

Check all four views (Landscape lanes populate, Data Flows chips + Orders trace animate, Data Stores fact card, Migration Map statuses). Then deploy per the [README](../README.md) (Vercel behind Cloudflare Access).

## 8. Optional: the AI chat editor + GitHub write-back

The "Edit with AI" bubble works with zero setup for browsing and proposing changes — it only needs a GitHub App to actually **save** a proposed change or list/revert History. If this client wants that, see the README's "AI chat editor & GitHub write-back" section for creating the App and setting its five env vars. Skip it entirely and the rest of the app is unaffected.
