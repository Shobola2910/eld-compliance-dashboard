import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { alerts } from "@/lib/db/schema";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ alertId: string }> }) {
  const { alertId } = await params;

  await db.update(alerts).set({ acknowledgedAt: new Date() }).where(eq(alerts.id, alertId));

  return NextResponse.json({ ok: true });
}
