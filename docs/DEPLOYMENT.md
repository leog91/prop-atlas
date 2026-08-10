# Deployment

## Web App

Deploy the web app as a Vercel project with **Root Directory** set to `apps/web`. The checked-in `apps/web/vercel.json` builds only the Next.js app; do not use the repository-root `bun run build` command in Vercel because it also builds the browser extension.

Set these production environment variables in Vercel:

```env
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-turso-token
BETTER_AUTH_SECRET=your-generated-secret
BETTER_AUTH_URL=https://your-domain.com
NEXT_PUBLIC_APP_URL=https://your-domain.com
ALLOWED_CORS_ORIGINS=https://your-domain.com,chrome-extension://your-extension-id
NOMINATIM_CONTACT=https://your-domain.com
```

`NOMINATIM_CONTACT` is sent in the geocoder's `User-Agent`, which OpenStreetMap's
usage policy requires so they can reach you about traffic. It falls back to
`NEXT_PUBLIC_APP_URL` when unset.

Generate `BETTER_AUTH_SECRET` with `openssl rand -base64 32`. Never expose the Turso token or auth secret with a `NEXT_PUBLIC_` prefix.

## Database

Create a Turso database in the region closest to your users. Apply migrations from a trusted workstation or CI job, not during Vercel's build:

```bash
TURSO_DATABASE_URL="libsql://your-database.turso.io" \
TURSO_AUTH_TOKEN="your-turso-token" \
bun run --filter @prop-atlas/db migrate:production
```

Production migration SQL is tracked in `packages/db/migrations/`. Generate a new migration after each schema change and commit it with the schema update:

```bash
bun run --filter @prop-atlas/db generate:production
```

The older `packages/db/drizzle/` directory is local-only and not a production migration source.

### Breaking change: hashed API keys

Migration `0002_drop_plaintext_api_keys` replaces the stored plaintext API key
with a SHA-256 hash. Existing keys cannot be rehashed in SQL, so the migration
deletes them. After applying it, every user must generate a new key on the
dashboard and repaste it into the extension.

## Extension

After the web app has a production URL, create `apps/extension/.env` with:

```env
PLASMO_PUBLIC_API_URL=https://your-domain.com
```

Build and distribute the extension separately from Vercel:

```bash
bun run --filter @prop-atlas/extension build
```

The extension build adds the configured API origin to its Chrome manifest automatically. After publishing through the Chrome Web Store, add the stable extension ID to Vercel's `ALLOWED_CORS_ORIGINS` and redeploy the web app.

## Privacy

The application stores account details, saved listings, notes, API keys, and provider payloads. Publish a privacy policy before public launch that describes these data categories, retention, deletion requests, Turso, Vercel, source listing providers, and OpenStreetMap Nominatim geocoding. Use a Turso region appropriate for your users and keep backup and access policies under review.
