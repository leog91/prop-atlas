# Development

## Setup

```bash
bun install
cp apps/web/.env.example apps/web/.env
cp apps/extension/.env.example apps/extension/.env
cd packages/db && bun run push
```

## Commands

```bash
bun run dev       # Start web + extension
bun run build     # Build all
bun run lint      # Lint all
bun run typecheck # Type-check all
```

## Extension API Origin

The extension can call only origins declared in `apps/extension/package.json`. `http://localhost:3000` is included for local development; add the deployed URL before building for production.

The web API's CORS policy is an exact allowlist. Add the loaded extension's ID to `ALLOWED_CORS_ORIGINS` in `apps/web/.env`, for example `http://localhost:3000,chrome-extension://abcdefghijklmnop`. Find the ID at `chrome://extensions`.

## Adding a Provider

1. Create parser in `packages/providers/src/parsers/`
2. Register in `packages/providers/src/index.ts`
3. Add host permissions in `apps/extension/package.json`
4. Update `apps/extension/scripts/postbuild.js` content script matches
5. Rebuild and test

## Using Page Snapshots for Parser Development

When a site changes its HTML structure and the parser breaks:

1. Open the extension popup on the listing page
2. Click **"Analyze Structure"** — this captures a semantic HTML map (meta tags, JSON-LD, key DOM nodes, and page text)
3. The snapshot is saved to the backend and appears at `/snapshots`
4. In the Snapshots page, expand the entry to inspect:
   - **Meta Tags** — Open Graph, Twitter, product metadata
   - **JSON-LD** — structured data schemas
   - **DOM Nodes** — tag, text, class, data-* attributes
   - **Page Text** — first 6,000 chars of `innerText` for regex analysis
5. Copy the JSON and feed it to an LLM to generate or fix parser code
6. Update the parser in `packages/providers/src/parsers/` and rebuild

## Database Changes

1. Update schema in `packages/db/src/schema/index.ts`
2. Run `bun run push` in `packages/db`
3. Update types in `packages/types/src/index.ts` if needed
4. Update API routes if needed
