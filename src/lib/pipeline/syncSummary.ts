import { desc, eq, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { companies, syncRuns } from "../db/schema";
import type { Provider } from "../providers/types";

const STUCK_RUNNING_THRESHOLD_MS = 5 * 60 * 1000;

export interface CompanySyncSummary {
  companyId: string;
  companyName: string;
  status: "running" | "success" | "partial" | "failed" | "never_synced" | "stuck";
  driversProcessed: number;
  errorMessage: string | null;
  finishedAt: Date | null;
}

export interface ProviderSyncSummary {
  totalCompanies: number;
  succeeded: number;
  notSucceeded: CompanySyncSummary[];
}

// Reads the most recent sync_runs row per company for this provider -- reflects
// whichever trigger ran last (manual Run button, the 30s auto-poll, or the
// 15-min GitHub Actions cron), not just the current request's own result.
export async function getLatestSyncSummary(provider: Provider): Promise<ProviderSyncSummary> {
  const allCompanies = await db.select().from(companies).where(eq(companies.provider, provider));
  if (allCompanies.length === 0) {
    return { totalCompanies: 0, succeeded: 0, notSucceeded: [] };
  }

  const companyIds = allCompanies.map((c) => c.id);
  const runs = await db
    .select()
    .from(syncRuns)
    .where(inArray(syncRuns.companyId, companyIds))
    .orderBy(desc(syncRuns.startedAt));

  const latestByCompany = new Map<string, (typeof runs)[number]>();
  for (const run of runs) {
    if (!latestByCompany.has(run.companyId)) latestByCompany.set(run.companyId, run);
  }

  const now = Date.now();
  const summaries: CompanySyncSummary[] = allCompanies.map((company) => {
    const run = latestByCompany.get(company.id);
    if (!run) {
      return {
        companyId: company.id,
        companyName: company.name,
        status: "never_synced",
        driversProcessed: 0,
        errorMessage: null,
        finishedAt: null,
      };
    }
    // A "running" row whose startedAt is old was almost certainly cut off by the
    // sync route's own timeout (Vercel Hobby caps functions at 60s) rather than
    // still actually in progress -- flag it distinctly instead of implying it's live.
    const isStuck = run.status === "running" && now - run.startedAt.getTime() > STUCK_RUNNING_THRESHOLD_MS;
    return {
      companyId: company.id,
      companyName: company.name,
      status: isStuck ? "stuck" : run.status,
      driversProcessed: run.driversProcessed,
      errorMessage: run.errorMessage ?? null,
      finishedAt: run.finishedAt ?? null,
    };
  });

  const succeeded = summaries.filter((s) => s.status === "success").length;
  const notSucceeded = summaries.filter((s) => s.status !== "success");

  return { totalCompanies: allCompanies.length, succeeded, notSucceeded };
}
