<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Where those docs actually live

The generated rule above assumes a single-app repo. This is a Bun workspace, so
Next is not hoisted to the repo root — read the guides from
`apps/web/node_modules/next/dist/docs/` instead.

## Checks

Run these from the repo root before considering a change done. There is no
hosted CI; these are the gate.

```bash
bun run typecheck
bun run lint
bun run test
```
