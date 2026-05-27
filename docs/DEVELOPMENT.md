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

## Adding a Provider

1. Create parser in `packages/providers/src/parsers/`
2. Register in `packages/providers/src/index.ts`
3. Add host permissions in `apps/extension/package.json`
4. Update `apps/extension/scripts/postbuild.js` content script matches
5. Update `apps/web/next.config.ts` image domains
6. Rebuild and test

## Database Changes

1. Update schema in `packages/db/src/schema/index.ts`
2. Run `bun run push` in `packages/db`
3. Update types in `packages/types/src/index.ts` if needed
4. Update API routes if needed
