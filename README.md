# ELD Compliance Dashboard

One dashboard for Leader ELD, Factor ELD, and Nexus ELD: auto-certify, auto-normalize, violation
tracking with timestamps, driver connect/disconnect monitoring, and alerts for drivers who haven't
updated shipping docs / trailer number in 3+ days.

Full design notes: `C:\Users\Ismoil\.claude\plans\sprightly-petting-corbato.md`.

## Local setup

1. `npm install`
2. Copy `.env.example` to `.env.local` (already done) and set `DATABASE_URL` to a real Postgres
   connection string (Neon / Vercel Postgres). Everything else in `.env.local` already has generated
   dev secrets.
3. Push the schema: `npm run db:push`
4. Create your login: `npm run seed:user -- you@company.com yourpassword`
5. `npm run dev`, then open http://localhost:3000 and sign in.
6. Populate mock data without waiting for real ELD tokens: log in, then
   `curl -X POST http://localhost:3000/api/dev/seed` (dev-only route, disabled in production). This
   saves a dummy token for each of the 3 providers and runs a full mock sync so the dashboard,
   driver pages, and alerts are populated end-to-end.

## Real ELD tokens

Go to Settings → Leader ELD / Factor ELD / Nexus ELD in the sidebar, paste that provider's bearer
token, and save. One token per provider unlocks every company and driver visible under that
account — saving it kicks off an immediate sync in the background.

Leader/Factor/Nexus's real API endpoints aren't wired up yet (`src/lib/providers/*/adapter.ts` are
TODO stubs) — until their docs are available, `ELD_MODE=mock` (the default) drives the whole app off
realistic fake data. Flip `ELD_MODE=live` once a given provider's `adapter.ts` is filled in.

## Sync cadence

The app runs on Fly.io as a persistent (always-on) machine, not a serverless function, so the sync
loop runs **inside the server process itself**: `src/instrumentation.ts` starts a `setInterval` when
the server boots (10s after startup, then every `SYNC_INTERVAL_MINUTES`, default 15) that calls
`runSyncForProvider` for Leader/Factor/Nexus directly — no external cron service needed.

`/api/cron/sync` (protected by `CRON_SECRET`) still exists as a manual/on-demand trigger — e.g. to
force an immediate resync from `curl` — but it's optional now.

## Deploying (Fly.io)

1. Install the CLI and log in: `curl -L https://fly.io/install.sh | sh`, then `fly auth login`
   (opens a browser to sign in/sign up).
2. From the project root: `fly launch --no-deploy` — it will detect the existing `Dockerfile` and
   `fly.toml`; confirm or rename the app (names are globally unique) and pick a region.
3. Create a Postgres database: `fly postgres create`, then `fly postgres attach <db-app-name>` to
   this app (this sets `DATABASE_URL` automatically) — or use an external Neon/Postgres URL instead.
4. Set the remaining secrets:
   ```
   fly secrets set TOKEN_ENC_KEY=... CRON_SECRET=... SESSION_SECRET=... ELD_MODE=mock
   ```
   (copy the generated values from your local `.env.local`, or generate fresh ones for production).
5. Deploy: `fly deploy`
6. Run the schema push and create your login against production, e.g. via `fly ssh console` or by
   running `DATABASE_URL=<prod-url> npm run db:push` / `npm run seed:user -- ...` from your machine.

GitHub stays the source of truth — push to `main`/`master` and re-run `fly deploy` (or wire up
`flyctl deploy` in a GitHub Actions workflow for auto-deploy-on-push, not included yet).
