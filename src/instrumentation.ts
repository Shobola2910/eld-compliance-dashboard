// Runs once when the Next.js server process boots. On a persistent host
// (Fly.io machine that stays running, unlike a serverless Vercel function)
// this lets us drive the ELD sync loop from an in-process interval instead
// of an external cron trigger.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.DISABLE_SYNC_LOOP === "true") return;

  const g = globalThis as { __eldSyncLoopStarted?: boolean };
  if (g.__eldSyncLoopStarted) return; // avoid double-start on dev hot reload
  g.__eldSyncLoopStarted = true;

  const { PROVIDERS } = await import("./lib/providers/registry");
  const { runSyncForProvider } = await import("./lib/pipeline/runSyncForProvider");

  const intervalMinutes = Number(process.env.SYNC_INTERVAL_MINUTES ?? "15");
  const intervalMs = intervalMinutes * 60 * 1000;

  async function runAllProviders() {
    for (const provider of PROVIDERS) {
      try {
        const result = await runSyncForProvider(provider);
        console.log(`[sync] ${provider}: ${result.status} (${result.companies.length} companies)`);
      } catch (err) {
        console.error(`[sync] ${provider} failed:`, err);
      }
    }
  }

  // Small initial delay so the DB connection/env is fully ready before the
  // first run, then repeat on a fixed interval for the lifetime of the process.
  setTimeout(runAllProviders, 10_000);
  setInterval(runAllProviders, intervalMs);
}
