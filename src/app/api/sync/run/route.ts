import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runSyncForProvider } from "@/lib/pipeline/runSyncForProvider";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  providers: z.array(z.enum(["leader", "factor", "nexus"])),
});

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const results = await Promise.allSettled(parsed.data.providers.map((p) => runSyncForProvider(p)));

  return NextResponse.json({
    results: results.map((r) => (r.status === "fulfilled" ? r.value : { error: r.reason?.message })),
  });
}
