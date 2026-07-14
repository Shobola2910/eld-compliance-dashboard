import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { providerTokens } from "@/lib/db/schema";
import { encryptToken } from "@/lib/crypto/tokenCipher";
import { runSyncForProvider } from "@/lib/pipeline/runSyncForProvider";
import { PROVIDERS } from "@/lib/providers/registry";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Dev-only helper: saves a dummy token for each provider (mock adapters
// ignore the actual token value) and runs a full sync, so the dashboard can
// be populated and clicked through before any real ELD token/docs exist.
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  for (const provider of PROVIDERS) {
    const { encryptedToken, iv, authTag } = encryptToken(`dev-mock-token-${provider}`);
    await db
      .insert(providerTokens)
      .values({ provider, encryptedToken, iv, authTag, tokenVersion: "v2", isValid: true, lastValidatedAt: new Date() })
      .onConflictDoUpdate({
        target: [providerTokens.provider],
        set: { encryptedToken, iv, authTag, isValid: true, lastValidatedAt: new Date(), updatedAt: new Date() },
      });
  }

  const results = await Promise.all(PROVIDERS.map((p) => runSyncForProvider(p)));

  return NextResponse.json({ results });
}
