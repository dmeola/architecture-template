# App architecture

How the explorer itself is built. For editing the *content* (systems, flows, migrations), see [data-model.md](data-model.md). For cloning to a new client, see [new-client.md](new-client.md).

## Rendering model

Everything is a single page (`src/app/page.tsx` → `Explorer`). The curated model is plain TypeScript imported at build time — the only server round-trips are the optional AI chat editor and its GitHub write-back (below); browsing the map itself is static data plus client state (which view/node is active). Graph components are `"use client"` because React Flow requires the DOM.

```
src/config/  (per-client: taxonomy, branding, swimlanes)
   │  derives union types, colors, legend, lane membership
   ▼
Explorer (view tabs + search + selection + phase state)
├── PhaseFilter (Current / Both / Target)
├── LandscapeView ─┐
├── DataFlowView  ─┼─→ FlowGraph (shared React Flow wrapper)
├── DataStoreView ─┘      ├── ArchNode (card-style custom node)
├── SequenceView (own renderer: SequenceDiagram, not FlowGraph)
├── MigrationView (no graph; card grid)
├── HistoryPanel (commit list + revert)
├── DetailPanel (slide-over fact sheet for the selected node)
└── ArchitectureChat (floating bubble + overlay — see below)
```

## The reactive model (`ModelContext` / `useModel()`)

Every view and component reads the model through `useModel()` (`src/lib/model/ModelContext.tsx`), never by importing `src/data/*` arrays directly. `buildModel()` (`src/data/model.ts`) is a pure function from the six raw arrays (+ `actors`) to a `Model` object — lookups (`nodeById`), derived collections (`flowsForNode()`), and the phase derivations (`nodePhase()`, `flowPhase()`, `sequencePhase()`). `staticModel` is just `buildModel()` called once on the real data at module load.

This indirection exists for one reason: the AI chat editor needs to render its *proposed, unsaved* changes on the real diagram before anything is committed. `ModelProvider` holds an optional `draftModel`; `useModel()` returns `draftModel ?? staticModel`. Nothing outside the chat ever calls `setDraftModel` — every other view is unaware a draft mechanism exists.

## Current / Target phase filter

`PhaseFilter` (in the header) sets a `Phase` (`"current" | "target" | "both"`) that `Explorer` threads into each graph view as a `phase` prop. Views filter their own node/edge subsets with `matchesPhase(nodePhase(node), phase)` before computing layout; `FlowGraph` and `layout.ts` have no phase awareness at all — filtering happens entirely upstream, in the views, against `Model`'s derived `nodePhase`/`flowPhase`/`sequencePhase`. See [data-model.md](data-model.md#current--target-phase) for what drives the derivation.

## The AI chat editor (`src/lib/chat/`, `src/app/api/chat/`)

`ArchitectureChat` is a floating bubble + overlay widget (not a docked panel) mounted once at the `Explorer` root, so it's reachable from every view without competing for layout space. It's built on the Vercel AI SDK's `useChat` hook talking to `POST /api/chat`, which runs `streamText` with a tool set built from `src/config/taxonomy.ts` (`createTools()` in `tools.ts`) — one add/update/remove tool per entity kind, plus `findEntities` for resolving a name the user typed to an internal id.

Pipeline for one chat turn:

1. The model calls a tool (e.g. `addFlow`). `tools.ts` runs `validateOperation()` (`validate.ts`) against the in-memory model built from `staticModel` + every op already applied this session, then folds it in via `applyOp()` (`ops.ts`) if valid.
2. The client derives the same operation list from the message history (`deriveAppliedToolCalls()` in `deriveOps.ts` — the inverse of what each tool's `execute()` built) and rebuilds a draft `Model` with `modelFromRaw()`, which `ArchitectureChat` pushes into `ModelContext` via `setDraftModel()`. This is the live preview — it never touches disk.
3. `ProposedChangesPanel` lists the applied calls with Discard/Save. **Save** posts to `POST /api/chat/save`, which independently re-derives and re-validates every operation from scratch (never trusts the client), groups them by target file (`entityKindForOp`/`FILE_FOR_KIND` in `entityKind.ts`), and for each file: fetches its *live* content from GitHub, applies each operation to the source text via `applyToSource.ts` (a `ts-morph` AST edit — add/patch/remove one object literal in the exported array, formatting untouched otherwise), and commits all touched files atomically through `src/lib/github/client.ts`.

Nothing here depends on this client's specific vocabulary — `tools.ts`'s Zod schemas and `entityKind.ts`'s field lists are generated from `src/config/taxonomy.ts` and `src/data/types.ts`. The only thing worth customizing per client is the `SYSTEM_PROMPT` string in `route.ts` if you want the assistant to know something client-specific beyond what the model itself already says.

## GitHub write-back and History (`src/lib/github/`, `HistoryPanel`)

`src/lib/github/client.ts` authenticates as a **GitHub App** (`@octokit/auth-app`) rather than a personal token, and hard-codes an allowlist of the six `src/data/*.ts` paths it will ever read or write — enforced independently of the chat's own tool scoping, so a jailbroken model still can't write outside the architecture data. `commitFiles()` builds one atomic commit via the Git Data API (blob → tree → commit → ref update), so a logical change spanning multiple files lands as a single commit.

The **History** tab (`HistoryPanel.tsx` → `GET /api/history` → `listDataCommits()`) lists recent commits touching `src/data`; **Revert** (`POST /api/history/revert` → `revertCommit()` in `lib/github/revert.ts`) restores just the files a past commit changed to their state as of that commit, as a new commit on top of `main` — never a history rewrite.

This whole feature is optional: without `GITHUB_APP_ID`/`GITHUB_APP_PRIVATE_KEY`/`GITHUB_APP_INSTALLATION_ID`/`GITHUB_OWNER`/`GITHUB_REPO` set, browsing works normally and the chat still proposes/previews changes — only Save and History fail, with a clear "isn't configured" error rather than a crash. See the README for how to create the GitHub App.

## Config vs. engine — what makes this a template

- **`src/config/`** is per-client. `taxonomy.ts` defines the vocabulary (tiers, statuses, flow kinds, domains) as arrays of `{ id, label, color }`; the union types in `src/data/types.ts` and every map in `src/lib/theme.ts` are *derived* from it, so adding a domain (etc.) is a one-line edit. `site.ts` holds branding + defaults; `landscape.ts` holds swimlanes.
- **`src/graph/`, `src/components/`, `src/lib/theme.ts`, `src/lib/model/`, `src/lib/chat/`, `src/lib/github/`, `src/proxy.ts`** are the generic engine — they consume config + data and never hard-code a client's ids or vocabulary. The one place worth a per-client look is the chat's `SYSTEM_PROMPT` (`src/app/api/chat/route.ts`) — the mechanics are generic, but you may want it to know something client-specific.

Onboarding a client is therefore: edit `src/config/*` + `src/data/*`, leave the engine alone.

## The shared graph engine (`src/graph/`)

`FlowGraph.tsx` is the one React Flow instance all graph views use. Views differ only in what they pass in:

- `positions: Map<id, Point>` — decides **which nodes render and where**. `FlowGraph` drops any flow whose endpoints aren't in the map, so views control membership purely through positions.
- `flows: FlowDef[]` — the edge subset to draw.
- `traceDomain` — colors edges by domain and animates/numbers edges that have a `step` (used by DataFlowView).
- `showLabels` — edge labels off for dense views (Landscape).
- `laneLabels` — static swimlane headers rendered as non-interactive nodes.

Hover/selection behavior lives entirely in `FlowGraph`: hovering (or selecting) a node dims everything outside its direct neighborhood; clicking the pane clears selection. Views pass a `key` prop when their subset changes (`key={domain}`, `key={storeId}`) to reset React Flow's internal state and refit the viewport.

Positioning strategies:

- **LandscapeView** computes fixed column/row positions from `src/config/landscape.ts`: each lane resolves to node ids by `tier`, by node `kind` (datastore/external), or an explicit id list. A new system in an existing tier appears automatically — no view edit needed.
- **DataFlowView / DataStoreView** derive the node subset from flows, then auto-layout with `dagreLayout()` (`layout.ts`, left-to-right).

## Selection and detail

`Explorer` owns `selectedId`. Every view, the search bar, and the DetailPanel's connection links all funnel through the same `onSelect(id)`. The DetailPanel resolves the id via `nodeById` and renders a kind-specific fact sheet plus incoming/outgoing flows from `flowsForNode()`.

## Theming

Dark-only. All graph colors originate in `src/config/taxonomy.ts` and are exposed through `src/lib/theme.ts` as inline hex, because React Flow node/edge styles are inline `style` objects, not classes. `nodeVisual()` maps a node to its accent/background: systems by `tier`, datastores and externals by `NODE_KIND_VISUALS`. UI chrome (headers, chips, panels) uses Tailwind slate/sky utilities directly; a few structural hex values remain inline in the engine and views.

## Access protection (`src/proxy.ts`)

Cloudflare Access sits in front of the production deployment; the proxy verifies the `Cf-Access-Jwt-Assertion` JWT against the team's JWKS (`jose`) so the raw `*.vercel.app` origin can't bypass Access. Enforcement activates only when `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` are both set; otherwise it fails open (local dev) and logs a warning on Vercel production. Static assets and Next internals are excluded via the `matcher`.

## Dependencies worth knowing

| Package | Role |
| --- | --- |
| `@xyflow/react` v12 | Graph canvas (pan/zoom, custom nodes/edges) |
| `@dagrejs/dagre` | Auto-layout for flow-derived views |
| `jose` | JWKS fetch + JWT verification in the proxy |
| `ai`, `@ai-sdk/react` | Chat streaming + tool-calling (`useChat`, `streamText`, `tool`) for the AI editor |
| `ts-morph` | AST-based edits to `src/data/*.ts` when a chat-approved change is saved |
| `zod` | Tool input schemas for the chat editor |
| `@octokit/rest`, `@octokit/auth-app` | GitHub App client for reading/committing the architecture data files |
| Tailwind 4 (via `@tailwindcss/postcss`) | Styling; no tailwind.config — theme tokens in `globals.css` |
