import type { ProviderStats } from "@/lib/pipeline/providerStats";
import { formatEdt } from "@/lib/format-time";

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-[#0d1117] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-slate-800/60 px-2.5 py-1 text-xs font-medium text-slate-300">{label}</span>
        <span className="text-lg font-semibold text-slate-100">{value}</span>
      </div>
    </div>
  );
}

export default function ProviderStatsCards({ stats }: { stats: ProviderStats }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label="Companies" value={stats.companiesCount} />
      <StatCard label="Drivers" value={stats.driversCount} />
      <StatCard label="Violations (9d)" value={stats.violations9d} />
      <StatCard label="Run started (ET)" value={stats.lastRunStartedAt ? formatEdt(stats.lastRunStartedAt) : "—"} />

      <StatCard label="Driving" value={stats.driving} />
      <StatCard label="On Duty" value={stats.onDuty} />
      <StatCard label="Sleeper" value={stats.sleeper} />
      <StatCard label="Off Duty" value={stats.offDuty} />

      <StatCard label="Personal Conveyance (PC)" value={stats.personalConveyance} />
      <StatCard label="Yard Move (YM)" value={stats.yardMove} />
      <StatCard label="ELD Disconnected" value={stats.eldDisconnected} />
      <StatCard label="PTI violations" value={stats.violationTypeCounts.pti} />

      <StatCard label="SHIFT violations" value={stats.violationTypeCounts.shift} />
      <StatCard label="CYCLE violations" value={stats.violationTypeCounts.cycle} />
      <StatCard label="DRIVING violations" value={stats.violationTypeCounts.driving} />
      <StatCard label="BREAK violations" value={stats.violationTypeCounts.breakType} />

      <StatCard label="OTHER violations" value={stats.violationTypeCounts.other} />
    </div>
  );
}
