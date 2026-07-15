import { NextRequest, NextResponse } from "next/server";
import { runSyncForProvider } from "@/lib/pipeline/runSyncForProvider";
import type { Provider } from "@/lib/providers/types";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const PROVIDER_VALUES = ["leader", "factor", "nexus"] as const;

function parseProvider(value: string): Provider | null {
  return (PROVIDER_VALUES as readonly string[]).includes(value) ? (value as Provider) : null;
}

// Manual "Check" trigger for the currently viewed provider tab -- re-syncs every
// company under that provider's token right now, instead of waiting for the
// 15-minute GitHub Actions cron.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerParam } = await params;
  const provider = parseProvider(providerParam);
  if (!provider) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  const result = await runSyncForProvider(provider);
  return NextResponse.json(result);
}
