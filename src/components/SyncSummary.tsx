import type { ProviderSyncSummary } from "@/lib/pipeline/syncSummary";

const STATUS_LABELS: Record<string, string> = {
  partial: "Qisman xato",
  failed: "Xato",
  never_synced: "Hali sinxronlanmagan",
  stuck: "To'xtab qolgan (vaqt tugadi)",
  running: "Hozir sinxronlanmoqda",
};

export default function SyncSummary({ summary }: { summary: ProviderSyncSummary }) {
  if (summary.totalCompanies === 0) return null;

  return (
    <div className="mt-3 rounded-md border border-slate-700/60 bg-slate-900/40 px-4 py-3">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="font-medium text-emerald-400">
          {summary.succeeded} / {summary.totalCompanies} muvaffaqiyatli
        </span>
        {summary.notSucceeded.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer list-none font-medium text-amber-400 hover:text-amber-300">
              {summary.notSucceeded.length} qo&apos;yilmadi
              <span className="ml-1 text-xs text-slate-500 group-open:hidden">(ko&apos;rish uchun bosing)</span>
            </summary>
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
              {summary.notSucceeded.map((c) => (
                <li key={c.companyId} className="flex flex-wrap items-baseline gap-1.5">
                  <span className="text-slate-200">{c.companyName}</span>
                  <span className="text-slate-500">·</span>
                  <span className="text-red-400">{STATUS_LABELS[c.status] ?? c.status}</span>
                  {c.errorMessage && <span className="text-slate-400">— {c.errorMessage}</span>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
