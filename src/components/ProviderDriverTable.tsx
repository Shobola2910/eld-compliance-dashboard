import Link from "next/link";
import { eq, isNull, sql, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { drivers, companies, violations } from "@/lib/db/schema";
import { isProfileStale } from "@/lib/pipeline/stale-profile";
import type { Provider } from "@/lib/providers/types";
import ConnectionBadge from "@/components/ConnectionBadge";
import ProviderIcon from "@/components/ProviderIcon";

export default async function ProviderDriverTable({ provider }: { provider: Provider }) {
  const [rows, openViolationCounts] = await Promise.all([
    db
      .select({
        driverId: drivers.id,
        driverName: drivers.name,
        truckNumber: drivers.truckNumber,
        trailerNumber: drivers.trailerNumber,
        connectionStatus: drivers.connectionStatus,
        shippingDocsUpdatedAt: drivers.shippingDocsUpdatedAt,
        companyName: companies.name,
      })
      .from(drivers)
      .innerJoin(companies, eq(drivers.companyId, companies.id))
      .where(and(eq(drivers.isActive, true), eq(drivers.provider, provider)))
      .orderBy(companies.name, drivers.name),
    db
      .select({ driverId: violations.driverId, count: sql<number>`count(*)` })
      .from(violations)
      .where(and(isNull(violations.resolvedAt), eq(violations.provider, provider)))
      .groupBy(violations.driverId),
  ]);

  const violationCountByDriver = new Map(openViolationCounts.map((v) => [v.driverId, Number(v.count)]));
  const now = new Date();

  if (rows.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-slate-800 bg-[#111623] p-6 text-sm text-slate-400">
        Token saved, waiting for the first sync to bring in companies and drivers.
      </div>
    );
  }

  return (
    <div className="mt-6 overflow-x-auto rounded-lg border border-slate-800">
      <table className="w-full text-sm">
        <thead className="bg-[#0d1117] text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Driver</th>
            <th className="px-4 py-3">Company</th>
            <th className="px-4 py-3">Truck #</th>
            <th className="px-4 py-3">Trailer #</th>
            <th className="px-4 py-3">Connection</th>
            <th className="px-4 py-3">Profile</th>
            <th className="px-4 py-3">Open violations</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map((row) => {
            const stale = isProfileStale(row.shippingDocsUpdatedAt, now);
            const openCount = violationCountByDriver.get(row.driverId) ?? 0;
            return (
              <tr key={row.driverId} className="bg-[#111623] hover:bg-[#151b2b]">
                <td className="px-4 py-3">
                  <Link
                    href={`/drivers/${row.driverId}`}
                    className="flex items-center gap-2 font-medium text-blue-400 hover:underline"
                  >
                    <ProviderIcon provider={provider} size="sm" />
                    {row.driverName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-300">{row.companyName}</td>
                <td className="px-4 py-3 text-slate-300">{row.truckNumber ?? "—"}</td>
                <td className="px-4 py-3 text-slate-300">{row.trailerNumber ?? "—"}</td>
                <td className="px-4 py-3">
                  <ConnectionBadge status={row.connectionStatus} />
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
                <td className="px-4 py-3">
                  {openCount > 0 ? (
                    <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400">
                      {openCount} open
                    </span>
                  ) : (
                    <span className="text-slate-500">0</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
