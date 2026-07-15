import Link from "next/link";
import BackButton from "@/components/BackButton";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0b0e14]">
      <header className="relative flex items-center justify-between border-b border-violet-500/20 bg-gradient-to-b from-[#12081f] to-[#0d1117] px-6 py-3 shadow-[0_1px_20px_-4px_rgba(139,92,246,0.35)]">
        <div className="flex items-center gap-3">
          <BackButton />
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-violet-500/60 bg-gradient-to-br from-violet-600/30 to-fuchsia-500/20 text-sm font-bold text-violet-300 shadow-[0_0_12px_-2px_rgba(168,85,247,0.6)]">
              E
            </div>
            <span className="text-sm">
              <span className="font-bold text-slate-100">ELD</span>{" "}
              <span className="font-medium text-slate-400">Dashboard</span>
            </span>
          </Link>
        </div>

        <Link
          href="/alerts"
          className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium text-slate-300 transition hover:bg-violet-500/10 hover:text-violet-300"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M10 2a6 6 0 0 0-6 6c0 3.09-1.207 5.267-2.263 6.61A1 1 0 0 0 2.5 16.25h15a1 1 0 0 0 .763-1.64C17.207 13.267 16 11.09 16 8a6 6 0 0 0-6-6ZM8.25 17.5a1.75 1.75 0 0 0 3.5 0h-3.5Z" />
          </svg>
          Alerts
        </Link>
      </header>

      <main className="overflow-x-auto p-6">{children}</main>
    </div>
  );
}
