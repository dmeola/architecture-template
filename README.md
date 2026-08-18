# Architecture Explorer (template)

A reusable, interactive map of a client's systems: what runs where, how data flows between systems, which stores each system touches, and how far along each legacy-to-modern migration is.

This repo is a **template**. It ships with a neutral sample dataset — "Acme Outfitters", a fictional mid-market retailer on Shopify with an iPaaS, OMS, and PIM — so it runs out of the box and doubles as a worked example. To build a real client's map, see [docs/new-client.md](docs/new-client.md).

## Running

```bash
npm install
npm run dev   # http://localhost:3000
```

## Views

- **System Landscape** — every system, data store, and external service in swimlanes. Lanes derive from each system's tier (plus data stores and externals), configured in `src/config/landscape.ts`. Hover a node to isolate its connections; click for the full fact sheet.
- **Data Flows** — filter the graph by business domain (Orders, Payments, Catalog, Inventory, Fulfillment, Customers, Marketing, Search, Reporting). The Orders domain traces the order lifecycle with numbered, animated steps.
- **Sequence Diagrams** — step-by-step call/response scenarios (e.g. checkout, payment capture) as lifeline diagrams.
- **Data Stores** — pick a store and see every system that reads or writes it, plus what lives inside.
- **Migration Map** — each modernization effort, what it replaces, and its status.
- **History** — commits made through the AI chat editor, with one-click revert.

A **Current / Both / Target** toggle in the header (Landscape, Data Flows, Sequence Diagrams, Data Stores) filters the map to one side of an in-flight migration — useful once a client has systems moving to a new platform; it's a no-op otherwise. See [docs/data-model.md](docs/data-model.md#current--target-phase).

An **"Edit with AI"** bubble (bottom-right, every view) opens a chat that can add/update/remove systems, data stores, externals, flows, migrations, and sequences by conversation, with a live preview on the real diagram before anything is saved. See below for what it needs to actually save changes.

## Configuring for a client

Two directories hold everything client-specific:

| Path | What it holds |
| --- | --- |
| `src/config/taxonomy.ts` | Tiers, system statuses, flow kinds, domains, migration statuses — each an array of `{ id, label, color }`. The TypeScript union types and all theme colors/labels derive from these arrays, so adding a domain (etc.) is a one-line edit. |
| `src/config/site.ts` | Branding: app name, titles, header text, default view and domain. |
| `src/config/landscape.ts` | Swimlane columns for the Landscape view (by tier, by kind, or an explicit id list). |
| `src/data/systems.ts` | Each system: tier, status, stack, runtime, notes. |
| `src/data/datastores.ts` | Databases and storage with their notable contents. |
| `src/data/externals.ts` | Third-party services. |
| `src/data/flows.ts` | Edges: source → target with kind, domain tags, label. `step` numbers a flow in the order-lifecycle trace; `planned: true` renders it dashed. |
| `src/data/migrations.ts` | Legacy → modern replacement pairs with status and summary. |

Add or edit entries and the views update automatically. Node `id`s are referenced by flows and migrations, so keep them stable.

Full editing reference: [docs/data-model.md](docs/data-model.md). How the app is built: [docs/app-architecture.md](docs/app-architecture.md). New-client runbook: [docs/new-client.md](docs/new-client.md).

## Deployment (Vercel behind Cloudflare Access)

1. Deploy the project to Vercel.
2. Point a Cloudflare-proxied subdomain (e.g. `architecture.example.com`) at Vercel; use Full (strict) SSL.
3. In Cloudflare Zero Trust, create an Access application for that hostname with your allow policy (email OTP or SSO).
4. Set these environment variables on Vercel to activate origin protection:
   - `CF_ACCESS_TEAM_DOMAIN` — your team domain, e.g. `myteam.cloudflareaccess.com`
   - `CF_ACCESS_AUD` — the Access application's Audience (AUD) tag

[src/proxy.ts](src/proxy.ts) verifies the `Cf-Access-Jwt-Assertion` JWT against the team's public signing keys on every request, so hitting the raw `*.vercel.app` URL without going through Access returns 403. When the env vars are unset (local dev), the check is skipped.

## AI chat editor & GitHub write-back

The chat itself (proposing changes, live preview) works with no setup — it talks to an LLM through the Vercel AI SDK Gateway, which authenticates automatically via `VERCEL_OIDC_TOKEN` on Vercel (no provider API key to manage). Set `CHAT_MODEL` to override the default (`openai/gpt-5-mini`).

**Saving** a proposed change, and the **History** tab (list/revert), need a GitHub App with permission to commit to this repo:

1. In the client's GitHub org, create a GitHub App (Settings → Developer settings → GitHub Apps) with:
   - Repository permissions → **Contents: Read and write**
   - No webhook needed
2. Install the App on this repo, and note the **Installation ID** from the install URL.
3. Generate a private key for the App (downloads a `.pem`).
4. Set these on Vercel (or `.env.local` for local dev — see [.env.example](.env.example)):
   - `GITHUB_APP_ID`
   - `GITHUB_APP_PRIVATE_KEY` — the full `.pem` contents (newlines as `\n` are handled automatically)
   - `GITHUB_APP_INSTALLATION_ID`
   - `GITHUB_OWNER` / `GITHUB_REPO` — this repo's org/name
   - `CHAT_BOT_EMAIL` (optional) — commit author email; defaults to `architecture-chatbot@example.com`

Without these, everything else still works — Save and History just fail with a clear configuration error instead of a crash. The integration only ever reads/writes the six `src/data/*.ts` files, enforced in [src/lib/github/client.ts](src/lib/github/client.ts) independent of the chat's own scoping.
