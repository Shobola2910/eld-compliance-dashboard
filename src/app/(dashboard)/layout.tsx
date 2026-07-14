import Link from "next/link";
import BackButton from "@/components/BackButton";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0b0e14]">
      <header className="flex items-center justify-between border-b border-slate-800 bg-[#0d1117] px-6 py-3">
        <div className="flex items-center gap-2">
          <BackButton />
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600/20 text-sm font-bold text-blue-400">
              E
            </div>
            <span className="text-sm font-semibold text-slate-100">ELD Dashboard</span>
          </Link>
        </div>

        <Link href="/alerts" className="text-sm text-slate-300 hover:text-slate-100">
          Alerts
        </Link>
      </header>

      <main className="overflow-x-auto p-6">{children}</main>
    </div>
  );
}
