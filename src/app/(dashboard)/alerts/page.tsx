import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { alerts, drivers, companies } from "@/lib/db/schema";
import AcknowledgeButton from "@/components/AcknowledgeButton";
import { formatEdt } from "@/lib/format-time";

export const dynamic = "force-dynamic";

const TYPE_STYLES: Record<string, string> = {
  disconnect: "bg-red-500/15 text-red-400",
  reconnect: "bg-emerald-500/15 text-emerald-400",
  stale_profile: "bg-amber-500/15 text-amber-400",
  sync_failed: "bg-slate-500/15 text-slate-400",
};

export default async function AlertsPage() {
  const rows = await db
    .select({
      id: alerts.id,
      type: alerts.type,
      message: alerts.message,
      triggeredAt: alerts.triggeredAt,
      acknowledgedAt: alerts.acknowledgedAt,
      driverId: alerts.driverId,
      companyName: companies.name,
    })
    .from(alerts)
    .innerJoin(companies, eq(alerts.companyId, companies.id))
    .leftJoin(drivers, eq(alerts.driverId, drivers.id))
    .orderBy(desc(alerts.triggeredAt))
    .limit(100);

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-100">Alerts</h1>
      <p className="mt-1 text-sm text-slate-400">Disconnect/reconnect events and stale driver profiles.</p>

      {rows.length === 0 ? (
        <div className="mt-8 rounded-lg border border-slate-800 bg-[#111623] p-6 text-sm text-slate-400">
          No alerts yet.
        </div>
      ) : (
        <ul className="mt-6 space-y-2">
          {rows.map((alert) => (
            <li
              key={alert.id}
              className={`flex items-center justify-between rounded-lg border border-slate-800 bg-[#111623] px-4 py-3 ${
                alert.acknowledgedAt ? "opacity-50" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_STYLES[alert.type] ?? ""}`}>
                  {alert.type.replace(/_/g, " ")}
                </span>
                <div>
                  <p className="text-sm text-slate-200">
                    {alert.driverId ? (
                      <Link href={`/drivers/${alert.driverId}`} className="text-blue-400 hover:underline">
                        {alert.message}
                      </Link>
                    ) : (
                      alert.message
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    {alert.companyName} — {formatEdt(alert.triggeredAt)}
                  </p>
                </div>
              </div>

              {!alert.acknowledgedAt && <AcknowledgeButton alertId={alert.id} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
