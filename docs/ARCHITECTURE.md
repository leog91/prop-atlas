# Architecture

## Overview

Monorepo with a Next.js web app and a Plasmo browser extension.

Extension extracts property data and sends it to the backend API, which stores it in Turso.

## Data Flow

1. **Extension**: Content script detects provider → parser extracts data → sends to API
2. **Backend**: Validates with Zod → authenticates via API key → checks duplicates → stores in Turso
3. **Frontend**: Dashboard queries saved properties → renders cards and map

## Snapshot Flow (Development-only)

> Page snapshots are a development aid. They are disabled in production builds and not shown to end users.

When adding or debugging a provider parser, you can capture the raw page structure of a listing:

1. **Extension**: In dev mode, the popup shows an **Analyze Structure** button. The content script builds a semantic HTML map (meta tags, JSON-LD, DOM nodes, page text, images, scripts) and sends it to `/api/snapshots/save`.
2. **Backend**: Authenticates via API key and stores the snapshot JSON in the `page_snapshots` table.
3. **Frontend**: In dev mode only, the `/snapshots` page lists captures. Expanding a snapshot shows its structure and lets you copy the JSON for LLM-assisted parser development.

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
- Images: plain `<img>` elements use native lazy loading; external listing hosts need no Next.js image configuration
