import { notFound } from "next/navigation";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { drivers, companies, normalizedLogs, violations, connectionEvents } from "@/lib/db/schema";
import { isProfileStale } from "@/lib/pipeline/stale-profile";
import { PROVIDER_LABELS } from "@/lib/providers/registry";
import ConnectionBadge from "@/components/ConnectionBadge";
import { formatEdt } from "@/lib/format-time";

export const dynamic = "force-dynamic";

export default async function DriverDetailPage({ params }: { params: Promise<{ driverId: string }> }) {
  const { driverId } = await params;

  const [driver] = await db
    .select({
      id: drivers.id,
      name: drivers.name,
      truckNumber: drivers.truckNumber,
      trailerNumber: drivers.trailerNumber,
      connectionStatus: drivers.connectionStatus,
      lastSeenAt: drivers.lastSeenAt,
      shippingDocsUpdatedAt: drivers.shippingDocsUpdatedAt,
      provider: drivers.provider,
      companyName: companies.name,
    })
    .from(drivers)
    .innerJoin(companies, eq(drivers.companyId, companies.id))
    .where(eq(drivers.id, driverId));

  if (!driver) notFound();

  const [logs, driverViolations, events] = await Promise.all([
    db.select().from(normalizedLogs).where(eq(normalizedLogs.driverId, driverId)).orderBy(desc(normalizedLogs.startedAt)).limit(50),
    db.select().from(violations).where(eq(violations.driverId, driverId)).orderBy(desc(violations.occurredAt)).limit(50),
    db.select().from(connectionEvents).where(eq(connectionEvents.driverId, driverId)).orderBy(desc(connectionEvents.occurredAt)).limit(50),
  ]);

  const stale = isProfileStale(driver.shippingDocsUpdatedAt, new Date());

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="text-sm text-slate-400 hover:text-slate-200">
          ← Back to drivers
        </Link>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-100">{driver.name}</h1>
          <ConnectionBadge status={driver.connectionStatus} />
          {stale && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400">
              Profile stale 3+ days
            </span>
          )}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Company</dt>
            <dd className="text-slate-200">{driver.companyName}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Provider</dt>
            <dd className="text-slate-200">{PROVIDER_LABELS[driver.provider]}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Truck #</dt>
            <dd className="text-slate-200">{driver.truckNumber ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Trailer #</dt>
            <dd className="text-slate-200">{driver.trailerNumber ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Last seen</dt>
            <dd className="text-slate-200">{formatEdt(driver.lastSeenAt)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Shipping docs updated</dt>
            <dd className="text-slate-200">{formatEdt(driver.shippingDocsUpdatedAt)}</dd>
          </div>
        </dl>
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Violations</h2>
        {driverViolations.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No violations recorded.</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-[#0d1117] text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Occurred at</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {driverViolations.map((v) => (
                  <tr key={v.id} className="bg-[#111623]">
                    <td className="px-4 py-2 text-slate-200">{v.type.replace(/_/g, " ")}</td>
                    <td className="px-4 py-2 text-slate-300">{formatEdt(v.occurredAt)}</td>
                    <td className="px-4 py-2">
                      {v.resolvedAt ? (
                        <span className="text-emerald-400">Resolved</span>
                      ) : (
                        <span className="text-red-400">Open</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-400">{v.description ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">HOS Logs</h2>
        {logs.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No logs recorded yet.</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-[#0d1117] text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Duty status</th>
                  <th className="px-4 py-2">Started</th>
                  <th className="px-4 py-2">Ended</th>
                  <th className="px-4 py-2">Certify status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {logs.map((log) => (
                  <tr key={log.id} className="bg-[#111623]">
                    <td className="px-4 py-2 text-slate-200">{log.dutyStatus.replace(/_/g, " ")}</td>
                    <td className="px-4 py-2 text-slate-300">{formatEdt(log.startedAt)}</td>
                    <td className="px-4 py-2 text-slate-300">{log.endedAt ? formatEdt(log.endedAt) : "in progress"}</td>
                    <td className="px-4 py-2 text-slate-400">{log.certifyStatus.replace(/_/g, " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Connect / Disconnect history</h2>
        {events.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No connection events recorded yet.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {events.map((event) => (
              <li key={event.id} className="flex items-center gap-3 rounded-md border border-slate-800 bg-[#111623] px-3 py-2">
                <ConnectionBadge status={event.status} />
                <span className="text-slate-400">{formatEdt(event.occurredAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
