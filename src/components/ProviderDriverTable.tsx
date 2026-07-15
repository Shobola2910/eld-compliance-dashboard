import Link from "next/link";
import { eq, and, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { drivers, companies, violations, normalizedLogs } from "@/lib/db/schema";
import { isProfileStale } from "@/lib/pipeline/stale-profile";
import { computeHosStatus, formatDuration, formatRelativeTime, CYCLE_LOOKBACK_MS, type DutySegment } from "@/lib/pipeline/hos-calculator";
import type { Provider } from "@/lib/providers/types";
import ConnectionBadge from "@/components/ConnectionBadge";
import ProviderIcon from "@/components/ProviderIcon";
import CheckCompanyButton from "@/components/CheckCompanyButton";
import { buildExternalDriverUrl } from "@/lib/providers/externalLinks";

const VIOLATIONS_WINDOW_DAYS = 9;

const DUTY_STATUS_LABELS: Record<string, string> = {
  driving: "Driving",
  on_duty: "On Duty",
  off_duty: "Off Duty",
  sleeper_berth: "Sleeper",
  unknown: "Unknown",
};

function CountdownBar({ remainingMs, totalMs }: { remainingMs: number; totalMs: number }) {
  const pct = Math.max(0, Math.min(100, (remainingMs / totalMs) * 100));
  const color = pct < 15 ? "bg-red-500" : pct < 40 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div>
      <span className="font-mono text-xs text-slate-200">{formatDuration(remainingMs)}</span>
      <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default async function ProviderDriverTable({ provider }: { provider: Provider }) {
  const now = new Date();
  const cycleSince = new Date(now.getTime() - CYCLE_LOOKBACK_MS);
  const violationsSince = new Date(now.getTime() - VIOLATIONS_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [companyRows, driverRows, logRows, violationCounts] = await Promise.all([
    db
      .select({ id: companies.id, name: companies.name, providerCompanyId: companies.providerCompanyId })
      .from(companies)
      .where(and(eq(companies.provider, provider), eq(companies.isActive, true)))
      .orderBy(companies.name),
    db
      .select({
        id: drivers.id,
        companyId: drivers.companyId,
        providerDriverId: drivers.providerDriverId,
        name: drivers.name,
        truckNumber: drivers.truckNumber,
        trailerNumber: drivers.trailerNumber,
        connectionStatus: drivers.connectionStatus,
        shippingDocsUpdatedAt: drivers.shippingDocsUpdatedAt,
        updatedAt: drivers.updatedAt,
      })
      .from(drivers)
      .where(and(eq(drivers.provider, provider), eq(drivers.isActive, true)))
      .orderBy(drivers.name),
    db
      .select({
        driverId: normalizedLogs.driverId,
        dutyStatus: normalizedLogs.dutyStatus,
        startedAt: normalizedLogs.startedAt,
        endedAt: normalizedLogs.endedAt,
      })
      .from(normalizedLogs)
      .where(and(eq(normalizedLogs.provider, provider), gte(normalizedLogs.startedAt, cycleSince)))
      .orderBy(normalizedLogs.startedAt),
    db
      .select({ driverId: violations.driverId, count: sql<number>`count(*)` })
      .from(violations)
      .where(and(eq(violations.provider, provider), gte(violations.occurredAt, violationsSince)))
      .groupBy(violations.driverId),
  ]);

  if (companyRows.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-slate-800 bg-[#111623] p-6 text-sm text-slate-400">
        Token saved, waiting for the first sync to bring in companies and drivers.
      </div>
    );
  }

  const logsByDriver = new Map<string, DutySegment[]>();
  for (const row of logRows) {
    const list = logsByDriver.get(row.driverId) ?? [];
    list.push({
      dutyStatus: row.dutyStatus as DutySegment["dutyStatus"],
      startedAt: row.startedAt,
      endedAt: row.endedAt ?? now,
    });
    logsByDriver.set(row.driverId, list);
  }

  const violationCountByDriver = new Map(violationCounts.map((v) => [v.driverId, Number(v.count)]));

  const driversByCompany = new Map<string, typeof driverRows>();
  for (const driver of driverRows) {
    const list = driversByCompany.get(driver.companyId) ?? [];
    list.push(driver);
    driversByCompany.set(driver.companyId, list);
  }

  return (
    <div className="mt-6 space-y-6">
      {companyRows.map((company) => {
        const companyDrivers = driversByCompany.get(company.id) ?? [];
        const hos = companyDrivers.map((d) => computeHosStatus(logsByDriver.get(d.id) ?? [], now));
        const drivingCount = hos.filter((h) => h.currentDutyStatus === "driving").length;

        return (
          <section key={company.id} className="overflow-hidden rounded-lg border border-slate-800">
            <div className="flex items-center justify-between bg-[#0d1117] px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">{company.name}</h3>
                <p className="text-xs text-slate-500">
                  {companyDrivers.length} drivers · {drivingCount} driving
                </p>
              </div>
              <CheckCompanyButton companyId={company.id} />
            </div>

            {companyDrivers.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No drivers yet for this company.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#0d1117] text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Violations ({VIOLATIONS_WINDOW_DAYS}D)</th>
                      <th className="px-4 py-2">Driver</th>
                      <th className="px-4 py-2">Truck #</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Break</th>
                      <th className="px-4 py-2">Drive</th>
                      <th className="px-4 py-2">Shift</th>
                      <th className="px-4 py-2">Cycle</th>
                      <th className="px-4 py-2">Profile</th>
                      <th className="px-4 py-2">Last change</th>
                      <th className="px-4 py-2">Last sync</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {companyDrivers.map((driver, i) => {
                      const status = hos[i];
                      const openCount = violationCountByDriver.get(driver.id) ?? 0;
                      const stale = isProfileStale(driver.shippingDocsUpdatedAt, now);
                      const segments = logsByDriver.get(driver.id) ?? [];
                      const lastChangeAt = segments.length > 0 ? segments[segments.length - 1].startedAt : null;
                      const externalUrl = buildExternalDriverUrl(provider, {
                        providerCompanyId: company.providerCompanyId,
                        providerDriverId: driver.providerDriverId,
                        name: driver.name,
                        truckNumber: driver.truckNumber,
                      });

                      return (
                        <tr key={driver.id} className="bg-[#111623] hover:bg-[#151b2b]">
                          <td className="px-4 py-3">
                            {openCount > 0 ? (
                              <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400">
                                {openCount} violation(s)
                              </span>
                            ) : (
                              <span className="text-xs text-slate-500">0 violation(s)</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {externalUrl ? (
                              <a
                                href={externalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`Open ${driver.name}'s log on the real ${provider} platform`}
                                className="flex items-center gap-2 font-medium text-blue-400 hover:underline"
                              >
                                <ProviderIcon provider={provider} size="sm" />
                                {driver.name}
                                <span className="text-xs text-slate-500">↗</span>
                              </a>
                            ) : (
                              <Link
                                href={`/drivers/${driver.id}`}
                                className="flex items-center gap-2 font-medium text-blue-400 hover:underline"
                              >
                                <ProviderIcon provider={provider} size="sm" />
                                {driver.name}
                              </Link>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-300">{driver.truckNumber ?? "—"}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <span className="w-fit rounded-full bg-slate-700/50 px-2 py-0.5 text-xs font-medium text-slate-200">
                                {DUTY_STATUS_LABELS[status.currentDutyStatus] ?? status.currentDutyStatus}
                              </span>
                              <ConnectionBadge status={driver.connectionStatus} />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <CountdownBar remainingMs={status.breakRemainingMs} totalMs={8 * 60 * 60 * 1000} />
                          </td>
                          <td className="px-4 py-3">
                            <CountdownBar remainingMs={status.driveRemainingMs} totalMs={11 * 60 * 60 * 1000} />
                          </td>
                          <td className="px-4 py-3">
                            <CountdownBar remainingMs={status.shiftRemainingMs} totalMs={14 * 60 * 60 * 1000} />
                          </td>
                          <td className="px-4 py-3">
                            <CountdownBar remainingMs={status.cycleRemainingMs} totalMs={70 * 60 * 60 * 1000} />
                          </td>
                          <td className="px-4 py-3">
                            {stale ? (
                              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400">
                                Stale 3+ days
                              </span>
                            ) : (
                              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
                                Up to date
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-400">
                            {lastChangeAt ? formatRelativeTime(lastChangeAt, now) : "—"}
                          </td>
                          <td className="px-4 py-3 text-slate-400">{formatRelativeTime(driver.updatedAt, now)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
