export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      <div className="inline-flex rounded-full border border-slate-800 bg-[#0d1117] p-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-9 w-28 rounded-full bg-slate-800/60" />
        ))}
      </div>

      <div className="mt-6 space-y-2">
        <div className="h-5 w-48 rounded bg-slate-800/60" />
        <div className="h-4 w-72 rounded bg-slate-800/40" />
        <div className="mt-4 h-40 rounded-lg border border-slate-800 bg-[#111623]" />
      </div>
    </div>
  );
}
