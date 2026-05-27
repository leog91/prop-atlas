# Prop Atlas

A property listing aggregator. Save rentals and sales from multiple platforms into one dashboard.

## Tech Stack

- **Web**: Next.js 16, React 18, TypeScript, Tailwind CSS
- **Auth**: Better Auth
- **Database**: Turso (LibSQL) with Drizzle ORM
- **Extension**: Plasmo Framework (Chrome MV3)
- **Monorepo**: Turborepo with Bun workspaces

## Quick Start

Prerequisites: Node.js 18+, Bun, Chrome

```bash
bun install

# Setup env
cp apps/web/.env.example apps/web/.env
cp apps/extension/.env.example apps/extension/.env

# Database
cd packages/db && bun run push

# Dev
bun run dev
```

Web app runs at http://localhost:3000. Extension builds in watch mode.

## Usage

1. **Sign up** at `/sign-up`
2. **Generate API key** on the dashboard
3. **Configure extension**: Open popup → Settings → Paste API key
4. **Save properties**: Visit a supported listing, click extension icon, hit "Save Property"
5. **Manage**: View, filter, favorite, and note properties on the dashboard

Supported platforms: Daft.ie, Kamernet.nl, Idealista, Zonaprop
