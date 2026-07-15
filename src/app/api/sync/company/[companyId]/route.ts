import { NextRequest, NextResponse } from "next/server";
import { runSyncForCompany } from "@/lib/pipeline/runSyncForProvider";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const result = await runSyncForCompany(companyId);
  return NextResponse.json(result);
}
