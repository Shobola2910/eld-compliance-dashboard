import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../db/client";
import { companies, drivers, violations, syncRuns } from "../db/schema";
import type { Provider } from "../providers/types";

const VIOLATIONS_WINDOW_DAYS = 9;

export interface ProviderStats {
  companiesCount: number;
  driversCount: number;
  violations9d: number;
  lastRunStartedAt: Date | null;
  driving: number;
  onDuty: number;
  sleeper: number;
  offDuty: number;
  // Not tracked yet on any provider -- no confirmed Personal Conveyance / Yard
  // Move / Pre-Trip-Inspection event or violation code has been found in any
  // real capture so far. Shown as 0 (honest "no data"), not fabricated.
  personalConveyance: number;
  yardMove: number;
  eldDisconnected: number;
  violationTypeCounts: {
    pti: number;
    shift: number;
    cycle: number;
    driving: number;
    breakType: number;
    other: number;
  };
}

export async function getProviderStats(provider: Provider): Promise<ProviderStats> {
  const now = new Date();
  const since = new Date(now.getTime() - VIOLATIONS_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [
    [companiesRow],
    [driversRow],
    [violations9dRow],
    [lastRunRow],
    dutyStatusRows,
    [disconnectedRow],
    violationTypeRows,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(companies)
      .where(and(eq(companies.provider, provider), eq(companies.isActive, true))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(drivers)
      .where(and(eq(drivers.provider, provider), eq(drivers.isActive, true))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(violations)
      .where(and(eq(violations.provider, provider), gte(violations.occurredAt, since))),
    db.select({ startedAt: sql<Date | null>`max(${syncRuns.startedAt})` }).from(syncRuns).where(eq(syncRuns.provider, provider)),
    db
      .select({ status: drivers.liveDutyStatus, count: sql<number>`count(*)` })
      .from(drivers)
      .where(and(eq(drivers.provider, provider), eq(drivers.isActive, true)))
      .groupBy(drivers.liveDutyStatus),
    db
      .select({ count: sql<number>`count(*)` })
      .from(drivers)
      .where(
        and(
          eq(drivers.provider, provider),
          eq(drivers.isActive, true),
          eq(drivers.connectionStatus, "disconnected")
        )
      ),
    db
      .select({ type: violations.type, count: sql<number>`count(*)` })
      .from(violations)
      .where(and(eq(violations.provider, provider), gte(violations.occurredAt, since)))
      .groupBy(violations.type),
  ]);

  const dutyCountByStatus = new Map(dutyStatusRows.map((r) => [r.status, Number(r.count)]));
  const violationCountByType = new Map(violationTypeRows.map((r) => [r.type, Number(r.count)]));

  return {
    companiesCount: Number(companiesRow?.count ?? 0),
    driversCount: Number(driversRow?.count ?? 0),
    violations9d: Number(violations9dRow?.count ?? 0),
    lastRunStartedAt: lastRunRow?.startedAt ? new Date(lastRunRow.startedAt) : null,
    driving: dutyCountByStatus.get("driving") ?? 0,
    onDuty: dutyCountByStatus.get("on_duty") ?? 0,
    sleeper: dutyCountByStatus.get("sleeper_berth") ?? 0,
    offDuty: dutyCountByStatus.get("off_duty") ?? 0,
    personalConveyance: 0,
    yardMove: 0,
    eldDisconnected: Number(disconnectedRow?.count ?? 0),
    violationTypeCounts: {
      pti: 0,
      shift: violationCountByType.get("duty_time") ?? 0,
      cycle: violationCountByType.get("cycle_limit") ?? 0,
      driving: violationCountByType.get("drive_time") ?? 0,
      breakType: violationCountByType.get("break_required") ?? 0,
      other: (violationCountByType.get("other") ?? 0) + (violationCountByType.get("unidentified_driving") ?? 0),
    },
  };
}
