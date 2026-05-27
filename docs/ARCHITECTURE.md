# Architecture

## Overview

Monorepo with a Next.js web app and a Plasmo browser extension.

Extension extracts property data and sends it to the backend API, which stores it in Turso.

## Data Flow

1. **Extension**: Content script detects provider → parser extracts data → sends to API
2. **Backend**: Validates with Zod → authenticates via API key → checks duplicates → stores in Turso
3. **Frontend**: Dashboard queries saved properties → renders cards and map

## Project Structure

```
apps/
  web/          # Next.js app (pages, API routes, components)
  extension/    # Plasmo extension (popup, content scripts)
packages/
  db/           # Drizzle schema and client
  types/        # Shared TypeScript types and Zod schemas
  providers/    # Property parsers per platform
```

## Key Conventions

- TypeScript strict mode, no `any`
- React: functional components, server components by default, `"use client"` for client components
- Database: Drizzle ORM only, index foreign keys, validate inputs with Zod
- Auth: Better Auth (web sessions), API keys (extension Bearer tokens)
- Images: plain `<img>` with `loading="lazy"`
