import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { providerTokens } from "@/lib/db/schema";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// Dispatcher: finds every provider with a valid saved token and fans out to
// /api/sync/run -- one request per provider, run in parallel, each within
// its own serverless invocation's time budget rather than one long request
// looping over every provider (and every company under it) sequentially.
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({ provider: providerTokens.provider })
    .from(providerTokens)
    .where(eq(providerTokens.isValid, true));

  if (rows.length === 0) {
    return NextResponse.json({ dispatched: 0 });
  }

  const appUrl = process.env.APP_URL ?? new URL(req.url).origin;
  const secret = process.env.CRON_SECRET;

  const dispatchResults = await Promise.allSettled(
    rows.map((row) =>
      fetch(`${appUrl}/api/sync/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({ providers: [row.provider] }),
      })
    )
  );

  const failed = dispatchResults.filter((r) => r.status === "rejected").length;

  return NextResponse.json({ dispatched: rows.length, failed });
}
