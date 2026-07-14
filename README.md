# ELD Compliance Dashboard

One dashboard for Leader ELD, Factor ELD, and Nexus ELD: auto-certify, auto-normalize, violation
tracking with timestamps, driver connect/disconnect monitoring, and alerts for drivers who haven't
updated shipping docs / trailer number in 3+ days.

There is no separate app login — the ELD provider token itself is the credential. Anyone with the
URL can open the dashboard and paste a token under Settings.

Full design notes: `C:\Users\Ismoil\.claude\plans\sprightly-petting-corbato.md`.

## Local setup

1. `npm install`
2. Copy `.env.example` to `.env.local` (already done) and set `DATABASE_URL` to a real Postgres
   connection string (Neon / Vercel Postgres). Everything else in `.env.local` already has generated
   dev secrets.
3. Push the schema: `npm run db:push`
4. `npm run dev`, then open http://localhost:3000.
5. Populate mock data without waiting for real ELD tokens:
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

Vercel's Hobby plan only allows daily native Cron Jobs, which is too slow for near-real-time
connect/disconnect tracking. So the real cadence comes from `.github/workflows/eld-sync.yml`
(GitHub Actions, free, every 15 minutes), which calls `/api/cron/sync`. `vercel.json` also
registers a once-daily Vercel Cron hitting the same endpoint as a fallback safety net.

For the GitHub Actions workflow to work after deploying, add two repo secrets under
**Settings → Secrets and variables → Actions**:
- `APP_URL` — your deployed Vercel URL (e.g. `https://your-app.vercel.app`)
- `CRON_SECRET` — same value as the `CRON_SECRET` env var set in Vercel

## Deploying (Vercel)

1. Go to https://vercel.com/new and sign in with **"Continue with GitHub"** (not email/password —
   this avoids any issue with an old Vercel account's 2FA, since it delegates auth straight to
   GitHub).
2. Import the `eld-compliance-dashboard` repo (already pushed to GitHub under Shobola2910) and let
   Vercel auto-detect it as Next.js.
3. Before deploying, add these Environment Variables (Production + Preview), copying the values
   from your local `.env.local`, or generating fresh ones for production:
   - `DATABASE_URL` — a real Postgres/Neon connection string (Vercel's Storage tab can provision
     one, or paste an existing Neon URL)
   - `TOKEN_ENC_KEY`
   - `CRON_SECRET`
   - `SESSION_SECRET`
   - `ELD_MODE=mock`
   - `APP_URL` — fill in once you know the deployed URL (can update after first deploy)
4. Click Deploy.
5. Add the same `APP_URL` / `CRON_SECRET` as GitHub Actions repo secrets (see above) so the 15-minute
   sync workflow can call the deployed app.
6. Run `npm run db:push` once, pointed at the production `DATABASE_URL` (from your own machine, with
   `DATABASE_URL` temporarily set to the production value), to create the schema. Then open the
   deployed URL and paste each provider's token under Settings — no login step needed.
