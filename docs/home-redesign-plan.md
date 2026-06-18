# Prop Atlas — Home/Auth/Demo Redesign Spec

## Overview
Move the dashboard to the root route (`/`) and turn the logged-out experience into a useful sign-in/landing page with a demo account. Remove the standalone `/dashboard` route.

## Goals
1. Root URL is always useful.
2. Interviewers can explore the app without signing up via a demo account.
3. Remove `/dashboard` route entirely.
4. Keep dark-mode support (system preference).
5. Provide a repeatable way to reset demo data.

## Tech Stack Context
- Next.js 16.2.6, React 19.2.4, Tailwind CSS v4
- Better Auth (email/password) with Drizzle/Turso
- Browser extension saves listings via API keys
- Dark mode via `prefers-color-scheme` in `globals.css`

## Demo Account
- Email: `demo@propatlas.com`
- Password: `demo1234`
- Sign-in page should show a “Use demo account” button that **pre-fills** the form.
- Demo data is resettable via a manual re-seed script.

## Detailed Tasks

### 1. Extract Dashboard UI
- Create `apps/web/components/property/DashboardShell.tsx`.
- Move the dashboard markup and data logic from `apps/web/app/dashboard/page.tsx` into this component.
- Keep it an async server component if possible, or pass pre-fetched data.

### 2. Root Route Behavior
- Update `apps/web/app/page.tsx`:
  - Check session with `auth.api.getSession({ headers })`.
  - If session exists → render `<DashboardShell />`.
  - If no session → render the sign-in/landing page component inline or redirect to `/sign-in`.

### 3. Remove `/dashboard`
- Delete `apps/web/app/dashboard/page.tsx`.
- Replace all hardcoded `/dashboard` links with `/`:
  - `apps/web/app/sign-in/page.tsx` success redirect
  - `apps/web/app/sign-up/page.tsx` success redirect
  - header logo links
  - any other references

### 4. Enhance Sign-In Page
- File: `apps/web/app/sign-in/page.tsx`
- Keep existing email/password form.
- Add a “Try demo account” card with:
  - email/password display
  - a button that pre-fills the form
- Add a short app pitch:
  - Track rental and buy listings across providers.
  - Save properties from Daft, Idealista, Kamernet, Zonaprop.
  - Browser extension for one-click saving.
  - Keep development-only features (e.g. page snapshots) out of the public landing page.
- Ensure all new UI uses `dark:` classes.

### 5. Demo Seed Script
- File: `apps/web/scripts/seed-demo.ts`.
- It should:
  - Sign up `demo@propatlas.com` / `demo1234` via Better Auth.
  - Create an API key for the browser extension.
  - Check for `apps/web/scripts/demo-data.json`.
    - If present, import the real listings it contains.
    - If absent, fall back to 4–6 synthetic sample properties.
- Add scripts in `apps/web/package.json` and the root `package.json`:
  ```json
  "db:seed:demo": "bun run --filter @prop-atlas/web db:seed:demo"
  ```

### 6. Demo Re-Seed Script
- File: `apps/web/scripts/reset-demo.ts`.
- It should:
  - Find the demo user by email.
  - Delete all related rows: `savedProperties`, `propertyImages`, `propertyPriceHistory`, `properties`, `apiKeys`, `pageSnapshots`, `verification`, user record, auth sessions.
  - Re-run the seed logic.
- Add scripts in `apps/web/package.json` and the root `package.json`:
  ```json
  "db:reset:demo": "bun run --filter @prop-atlas/web db:reset:demo"
  ```

### 7. Demo Export Script
- File: `apps/web/scripts/export-demo.ts`.
- After signing in as the demo user and saving real listings via the browser extension, run this script to export the demo account’s data into `apps/web/scripts/demo-data.json`.
- The JSON is portable: DB IDs are stripped so re-seeding generates fresh IDs.
- Add scripts in `apps/web/package.json` and the root `package.json`:
  ```json
  "db:export:demo": "bun run --filter @prop-atlas/web db:export:demo"
  ```

### Real-listing demo workflow
1. Run `bun run db:reset:demo` to create a clean demo user + API key.
2. Start the dev server and sign in as `demo@propatlas.com` / `demo1234`.
3. Configure the browser extension with the demo API key shown in the dashboard.
4. Save 4–6 real listings from Daft, Idealista, Kamernet, or Zonaprop.
5. Run `bun run db:export:demo` to write `demo-data.json`.
6. Future `bun run db:reset:demo` calls will recreate those same real listings.
7. When listings go stale, repeat steps 2–5.

## Acceptance Criteria
- [ ] `/` shows the dashboard when logged in.
- [ ] `/` shows the enhanced sign-in page when logged out.
- [ ] `/dashboard` no longer exists or redirects to `/`.
- [ ] Demo credentials pre-fill the sign-in form.
- [ ] Demo user can sign in and see seeded properties.
- [ ] Re-seed script successfully resets demo data.
- [ ] `bun run lint` passes.
- [ ] Dark mode classes are applied to new UI.

## Notes for Next AI/Developer
- Do not change auth schema or session logic.
- Do not add a theme toggle unless requested; keep system-based dark mode.
- Keep the existing `PropertyCard` and `DashboardContent` components untouched unless necessary.
- For demo images, use reliable placeholder URLs or Unsplash source URLs.
