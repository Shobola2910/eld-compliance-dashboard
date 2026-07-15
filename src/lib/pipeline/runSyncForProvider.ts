import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/client";
import {
  companies,
  providerTokens,
  drivers,
  normalizedLogs,
  violations,
  connectionEvents,
  alerts,
  syncRuns,
} from "../db/schema";
import { getAdapter } from "../providers/registry";
import { decryptToken } from "../crypto/tokenCipher";
import { normalizeDutyStatus, normalizeViolationType } from "./normalize";
import { isEligibleForAutoCertify } from "./certify";
import { detectConnectionChange, ConnectionStatus } from "./connection-status";
import { isProfileStale } from "./stale-profile";
import type { EldAdapter, Provider, ProviderCredentials } from "../providers/types";

const LOG_WINDOW_HOURS = 48;
const DRIVER_PAGE_SIZE = 25;

export interface CompanySyncResult {
  companyId: string;
  companyName: string;
  provider: Provider;
  status: "success" | "partial" | "failed";
  driversProcessed: number;
  errorMessage?: string;
}

export interface ProviderSyncResult {
  provider: Provider;
  status: "success" | "partial" | "failed";
  companies: CompanySyncResult[];
  errorMessage?: string;
}

// Entry point: one Leader/Factor/Nexus token unlocks every company visible
// under that provider account. We discover those companies via
// adapter.listCompanies(), upsert them, then sync each one's drivers.
export async function runSyncForProvider(provider: Provider): Promise<ProviderSyncResult> {
  const [tokenRow] = await db.select().from(providerTokens).where(eq(providerTokens.provider, provider));

  if (!tokenRow || !tokenRow.isValid) {
    return { provider, status: "failed", companies: [], errorMessage: "No valid token saved for this provider" };
  }

  const adapter = getAdapter(provider);
  let credentials: ProviderCredentials;
  try {
    credentials = { token: decryptToken(tokenRow), tenantId: tokenRow.tenantId ?? undefined };
  } catch (err) {
    return { provider, status: "failed", companies: [], errorMessage: `Token decryption failed: ${(err as Error).message}` };
  }

  let providerCompanies: { providerCompanyId: string; name: string }[];
  try {
    providerCompanies = await adapter.listCompanies(credentials);
  } catch (err) {
    return { provider, status: "failed", companies: [], errorMessage: (err as Error).message };
  }

  const results: CompanySyncResult[] = [];

  for (const pc of providerCompanies) {
    const [company] = await db
      .insert(companies)
      .values({ provider, providerCompanyId: pc.providerCompanyId, name: pc.name })
      .onConflictDoUpdate({
        target: [companies.provider, companies.providerCompanyId],
        set: { name: pc.name, updatedAt: new Date() },
      })
      .returning();

    const result = await syncOneCompany(company.id, company.name, provider, adapter, credentials);
    results.push(result);
  }

  const anyFailed = results.some((r) => r.status === "failed");
  const anyPartial = results.some((r) => r.status === "partial");
  const status = anyFailed ? "partial" : anyPartial ? "partial" : "success";

  return { provider, status, companies: results };
}

// Re-sync a single already-discovered company on demand (e.g. the "Check" button
// next to a company's driver list), without re-running listCompanies for the
// whole provider.
export async function runSyncForCompany(companyId: string): Promise<CompanySyncResult> {
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
  if (!company) {
    return { companyId, companyName: "Unknown", provider: "leader", status: "failed", driversProcessed: 0, errorMessage: "Company not found" };
  }

  const [tokenRow] = await db.select().from(providerTokens).where(eq(providerTokens.provider, company.provider));
  if (!tokenRow || !tokenRow.isValid) {
    return {
      companyId,
      companyName: company.name,
      provider: company.provider,
      status: "failed",
      driversProcessed: 0,
      errorMessage: "No valid token saved for this provider",
    };
  }

  let credentials: ProviderCredentials;
  try {
    credentials = { token: decryptToken(tokenRow), tenantId: tokenRow.tenantId ?? undefined };
  } catch (err) {
    return {
      companyId,
      companyName: company.name,
      provider: company.provider,
      status: "failed",
      driversProcessed: 0,
      errorMessage: `Token decryption failed: ${(err as Error).message}`,
    };
  }

  const adapter = getAdapter(company.provider);
  return syncOneCompany(company.id, company.name, company.provider, adapter, credentials);
}

async function syncOneCompany(
  companyId: string,
  companyName: string,
  provider: Provider,
  adapter: EldAdapter,
  credentials: ProviderCredentials
): Promise<CompanySyncResult> {
  const [syncRun] = await db.insert(syncRuns).values({ companyId, provider, status: "running" }).returning();

  const now = new Date();
  const since = new Date(now.getTime() - LOG_WINDOW_HOURS * 60 * 60 * 1000);

  let driversProcessed = 0;
  let hadError = false;
  let lastErrorMessage: string | undefined;

  const [company] = await db.select().from(companies).where(eq(companies.id, companyId));

  try {
    let cursor: string | undefined;
    do {
      const page = await adapter.listDrivers(credentials, company.providerCompanyId, {
        cursor,
        pageSize: DRIVER_PAGE_SIZE,
      });

      for (const rawDriver of page.drivers) {
        try {
          await syncOneDriver({ companyId, provider, rawDriver, since, until: now, adapter, credentials });
          driversProcessed += 1;
        } catch (err) {
          hadError = true;
          lastErrorMessage = (err as Error).message;
        }
      }

      cursor = page.nextCursor ?? undefined;
    } while (cursor);
  } catch (err) {
    await finishSyncRun(syncRun.id, "failed", driversProcessed, (err as Error).message);
    return { companyId, companyName, provider, status: "failed", driversProcessed, errorMessage: (err as Error).message };
  }

  await scanStaleProfiles(companyId);

  const status = hadError ? "partial" : "success";
  await finishSyncRun(syncRun.id, status, driversProcessed, lastErrorMessage);

  return { companyId, companyName, provider, status, driversProcessed, errorMessage: lastErrorMessage };
}

async function finishSyncRun(
  syncRunId: string,
  status: "success" | "partial" | "failed",
  driversProcessed: number,
  errorMessage?: string
) {
  await db
    .update(syncRuns)
    .set({ status, driversProcessed, errorMessage, finishedAt: new Date() })
    .where(eq(syncRuns.id, syncRunId));
}

async function syncOneDriver(args: {
  companyId: string;
  provider: Provider;
  rawDriver: import("../providers/types").RawDriverRecord;
  since: Date;
  until: Date;
  adapter: EldAdapter;
  credentials: ProviderCredentials;
}) {
  const { companyId, provider, rawDriver, since, until, adapter, credentials } = args;

  const [existingDriver] = await db
    .select()
    .from(drivers)
    .where(
      and(
        eq(drivers.companyId, companyId),
        eq(drivers.provider, provider),
        eq(drivers.providerDriverId, rawDriver.providerDriverId)
      )
    );

  const previousStatus: ConnectionStatus = existingDriver?.connectionStatus ?? "unknown";
  const newStatus = rawDriver.connectionStatus;
  const liveDutyStatus = rawDriver.liveDutyStatus ? normalizeDutyStatus(provider, rawDriver.liveDutyStatus) : null;

  const [driver] = await db
    .insert(drivers)
    .values({
      companyId,
      provider,
      providerDriverId: rawDriver.providerDriverId,
      name: rawDriver.name,
      truckNumber: rawDriver.truckNumber,
      trailerNumber: rawDriver.trailerNumber,
      shippingDocsUpdatedAt: rawDriver.shippingDocsUpdatedAt ? new Date(rawDriver.shippingDocsUpdatedAt) : null,
      connectionStatus: newStatus,
      lastSeenAt: rawDriver.lastSeenAt ? new Date(rawDriver.lastSeenAt) : null,
      liveDutyStatus,
      liveBreakRemainingMs: rawDriver.liveHos?.breakRemainingMs,
      liveDriveRemainingMs: rawDriver.liveHos?.driveRemainingMs,
      liveShiftRemainingMs: rawDriver.liveHos?.shiftRemainingMs,
      liveCycleRemainingMs: rawDriver.liveHos?.cycleRemainingMs,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [drivers.companyId, drivers.provider, drivers.providerDriverId],
      set: {
        name: rawDriver.name,
        truckNumber: rawDriver.truckNumber,
        trailerNumber: rawDriver.trailerNumber,
        shippingDocsUpdatedAt: rawDriver.shippingDocsUpdatedAt ? new Date(rawDriver.shippingDocsUpdatedAt) : null,
        connectionStatus: newStatus,
        lastSeenAt: rawDriver.lastSeenAt ? new Date(rawDriver.lastSeenAt) : null,
        liveDutyStatus,
        liveBreakRemainingMs: rawDriver.liveHos?.breakRemainingMs,
        liveDriveRemainingMs: rawDriver.liveHos?.driveRemainingMs,
        liveShiftRemainingMs: rawDriver.liveHos?.shiftRemainingMs,
        liveCycleRemainingMs: rawDriver.liveHos?.cycleRemainingMs,
        updatedAt: new Date(),
      },
    })
    .returning();

  const connectionChange = detectConnectionChange(previousStatus, newStatus);
  if (connectionChange) {
    await db.insert(connectionEvents).values({
      driverId: driver.id,
      status: connectionChange,
      occurredAt: new Date(),
    });
    await db.insert(alerts).values({
      driverId: driver.id,
      companyId,
      type: connectionChange === "disconnected" ? "disconnect" : "reconnect",
      message:
        connectionChange === "disconnected"
          ? `${driver.name} (truck ${driver.truckNumber ?? "?"}) disconnected`
          : `${driver.name} (truck ${driver.truckNumber ?? "?"}) reconnected`,
      metadata: { previousStatus, newStatus },
    });
  }

  const [violationPage, logPage] = await Promise.all([
    adapter.listViolations(credentials, rawDriver.providerDriverId, { since, until, pageSize: 100 }),
    adapter.listLogs(credentials, rawDriver.providerDriverId, { since, until, pageSize: 100 }),
  ]);

  for (const rawViolation of violationPage.violations) {
    await db
      .insert(violations)
      .values({
        driverId: driver.id,
        provider,
        providerViolationId: rawViolation.providerViolationId,
        type: normalizeViolationType(provider, rawViolation.type),
        occurredAt: new Date(rawViolation.occurredAt),
        resolvedAt: rawViolation.resolvedAt ? new Date(rawViolation.resolvedAt) : null,
        description: rawViolation.description,
        rawPayload: rawViolation.raw,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [violations.driverId, violations.provider, violations.providerViolationId],
        set: {
          resolvedAt: rawViolation.resolvedAt ? new Date(rawViolation.resolvedAt) : null,
          description: rawViolation.description,
          rawPayload: rawViolation.raw,
          updatedAt: new Date(),
        },
      });
  }

  const openViolations = await db
    .select()
    .from(violations)
    .where(and(eq(violations.driverId, driver.id), isNull(violations.resolvedAt)));

  const logsToCertify: { id: string; providerLogId: string }[] = [];

  for (const rawLog of logPage.logs) {
    const startedAt = new Date(rawLog.startedAt);
    const endedAt = rawLog.endedAt ? new Date(rawLog.endedAt) : null;

    const hasOverlappingOpenViolation = openViolations.some(
      (v) => v.occurredAt >= startedAt && (!endedAt || v.occurredAt <= endedAt)
    );

    const [log] = await db
      .insert(normalizedLogs)
      .values({
        driverId: driver.id,
        provider,
        providerLogId: rawLog.providerLogId,
        dutyStatus: normalizeDutyStatus(provider, rawLog.dutyStatus),
        startedAt,
        endedAt,
        odometer: rawLog.odometer?.toString(),
        originLat: rawLog.location?.lat.toString(),
        originLng: rawLog.location?.lng.toString(),
        rawPayload: rawLog.raw,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [normalizedLogs.driverId, normalizedLogs.provider, normalizedLogs.providerLogId],
        set: {
          dutyStatus: normalizeDutyStatus(provider, rawLog.dutyStatus),
          endedAt,
          odometer: rawLog.odometer?.toString(),
          rawPayload: rawLog.raw,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (
      log.certifyStatus === "pending" &&
      isEligibleForAutoCertify({ startedAt, endedAt, hasOverlappingOpenViolation })
    ) {
      logsToCertify.push({ id: log.id, providerLogId: log.providerLogId });
    }
  }

  if (logsToCertify.length > 0) {
    const results = await adapter.certifyLogs(credentials, logsToCertify.map((l) => l.providerLogId));
    const resultByProviderLogId = new Map(results.map((r) => [r.providerLogId, r]));

    for (const { id, providerLogId } of logsToCertify) {
      const result = resultByProviderLogId.get(providerLogId);
      if (result?.success) {
        await db
          .update(normalizedLogs)
          .set({ certifyStatus: "auto_certified", certifiedAt: new Date(), updatedAt: new Date() })
          .where(eq(normalizedLogs.id, id));
      }
    }
  }
}

async function scanStaleProfiles(companyId: string) {
  const activeDrivers = await db
    .select()
    .from(drivers)
    .where(and(eq(drivers.companyId, companyId), eq(drivers.isActive, true)));

  const now = new Date();

  for (const driver of activeDrivers) {
    const stale = isProfileStale(driver.shippingDocsUpdatedAt, now);
    if (!stale) continue;

    const [existingOpenAlert] = await db
      .select()
      .from(alerts)
      .where(and(eq(alerts.driverId, driver.id), eq(alerts.type, "stale_profile"), isNull(alerts.acknowledgedAt)));

    if (existingOpenAlert) continue;

    const daysSinceUpdate = driver.shippingDocsUpdatedAt
      ? Math.floor((now.getTime() - driver.shippingDocsUpdatedAt.getTime()) / (24 * 60 * 60 * 1000))
      : null;

    await db.insert(alerts).values({
      driverId: driver.id,
      companyId,
      type: "stale_profile",
      message: `${driver.name} (truck ${driver.truckNumber ?? "?"}) hasn't updated shipping docs/trailer number in ${
        daysSinceUpdate ?? "3+"
      } days`,
      metadata: { daysSinceUpdate },
    });

    await db.update(drivers).set({ profileLastCheckedAt: now }).where(eq(drivers.id, driver.id));
  }
}
