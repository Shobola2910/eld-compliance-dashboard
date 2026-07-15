import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { providerTokens } from "@/lib/db/schema";
import { encryptToken } from "@/lib/crypto/tokenCipher";
import { getAdapter } from "@/lib/providers/registry";
import { runSyncForProvider } from "@/lib/pipeline/runSyncForProvider";
import type { Provider } from "@/lib/providers/types";

const PROVIDER_VALUES = ["leader", "factor", "nexus"] as const;

const bodySchema = z.object({
  token: z.string().min(4),
  tenantId: z.string().min(1).optional(),
  tokenVersion: z.enum(["v1", "v2"]).default("v2"),
});

function parseProvider(value: string): Provider | null {
  return (PROVIDER_VALUES as readonly string[]).includes(value) ? (value as Provider) : null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerParam } = await params;
  const provider = parseProvider(providerParam);
  if (!provider) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { token, tenantId: newTenantId, tokenVersion } = parsed.data;

  // Once a tenant_id has been saved once, never ask for it again -- reuse the
  // stored value on every later token update unless a new one is explicitly given.
  const [existing] = await db.select().from(providerTokens).where(eq(providerTokens.provider, provider));
  const tenantId = newTenantId ?? existing?.tenantId ?? undefined;

  const adapter = getAdapter(provider);
  const validation = await adapter.validateToken({ token, tenantId }).catch((err) => ({
    valid: false,
    reason: (err as Error).message,
  }));

  if (!validation.valid) {
    return NextResponse.json({ error: validation.reason ?? "Token rejected" }, { status: 400 });
  }

  const { encryptedToken, iv, authTag } = encryptToken(token);

  await db
    .insert(providerTokens)
    .values({ provider, encryptedToken, iv, authTag, tenantId, tokenVersion, isValid: true, lastValidatedAt: new Date() })
    .onConflictDoUpdate({
      target: [providerTokens.provider],
      set: {
        encryptedToken,
        iv,
        authTag,
        tenantId,
        tokenVersion,
        isValid: true,
        lastValidatedAt: new Date(),
        updatedAt: new Date(),
      },
    });

  after(() => runSyncForProvider(provider).catch((err) => console.error(`sync after token save failed: ${err}`)));

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerParam } = await params;
  const provider = parseProvider(providerParam);
  if (!provider) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  // Mark invalid rather than deleting the row -- this keeps the saved tenant_id
  // (and any other per-account fields) around so reconnecting later never asks for it again.
  await db.update(providerTokens).set({ isValid: false, updatedAt: new Date() }).where(eq(providerTokens.provider, provider));

  return NextResponse.json({ ok: true });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerParam } = await params;
  const provider = parseProvider(providerParam);
  if (!provider) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  const [row] = await db.select().from(providerTokens).where(eq(providerTokens.provider, provider));

  if (!row) {
    return NextResponse.json({ saved: false });
  }

  return NextResponse.json({
    saved: true,
    isValid: row.isValid,
    tokenVersion: row.tokenVersion,
    lastValidatedAt: row.lastValidatedAt,
    hasTenantId: !!row.tenantId,
  });
}
