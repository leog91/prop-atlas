# Prop Atlas

A property listing aggregator. Save rentals and sales from multiple platforms into one dashboard.

## Tech Stack

- **Web**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Auth**: Better Auth
- **Database**: Turso (LibSQL) with Drizzle ORM
- **Extension**: Plasmo Framework (Chrome MV3)
- **Monorepo**: Turborepo with Bun workspaces

## Quick Start

Prerequisites: Node.js 18+, Bun, Chrome

```bash
bun install

# Set up the web environment
cp apps/web/.env.example apps/web/.env

# Database
cd packages/db && bun run push

# Dev
bun run dev
```

Web app runs at http://localhost:3000. Extension builds in watch mode.

## Usage

1. **Sign up** at `/sign-up`
2. **Generate API key** on the dashboard. Only a hash is stored, so the key is
   displayed once at creation — copy it before leaving the page. Regenerating
   issues a new key and invalidates the previous one.
3. **Configure extension**: Open popup → Settings → Paste API key
4. **Save properties**: Visit a supported listing, click extension icon, hit "Save Property"
5. **Manage**: View, filter, favorite, and note properties on the dashboard

Supported platforms: Daft.ie, Kamernet.nl, Idealista, Zonaprop

See [deployment instructions](docs/DEPLOYMENT.md) for Turso migrations, Vercel configuration, extension release, and privacy considerations.

### Extension API access

Chrome requires explicit permission for every API origin used by an extension. The manifest includes both `http://localhost:3000` and `https://prop-atlas-web.vercel.app`. Choose **Production** or **Development (localhost)** in the extension settings; the selection is saved locally in Chrome.

The API only permits configured origins. After loading an unpacked extension, copy its ID from `chrome://extensions` and add `chrome-extension://<extension-id>` to `ALLOWED_CORS_ORIGINS` in `apps/web/.env`, alongside the app URL.

## Page Snapshots (development-only)

Page snapshots help during parser development. They capture a listing page’s raw structure (meta tags, JSON-LD, DOM nodes, page text, images, scripts) so you can inspect it while building or debugging a provider parser.

- Available only in `NODE_ENV=development`.
- Hidden from production builds: the dashboard link, `/snapshots` page, and snapshot API routes are disabled.
- The extension popup only shows the **Analyze Structure** button in dev builds.

To capture a snapshot:

1. Start the app in dev mode and sign in.
2. Open the extension popup and click **Analyze Structure** on a supported listing page.
3. Visit `/snapshots` in the web app to inspect the captured structure.
4. Copy the JSON to feed to an LLM or use it directly to understand the provider’s HTML layout.

Snapshots are stored per-user in the `page_snapshots` table and can be deleted from the `/snapshots` page.

## Demo account

A read-only demo account is available for sharing and portfolio use:

- Email: `demo@propatlas.com`
- Password: `demo1234`

To refresh its data:

1. Update `apps/web/scripts/demo-data.json` with the listings to display.
2. Reset the demo user:
   ```bash
   bun run db:reset:demo
   ```
3. Start the app:
   ```bash
   bun run dev
   ```
4. Sign in at `http://localhost:3000` with the demo credentials to verify the data.

The demo account cannot generate API keys or modify saved properties. Use a separate account when capturing listings with the extension.

> Demo data is sourced from public listings and may be outdated.
