import Link from "next/link";

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/alerts", label: "Alerts" },
];

const PROVIDER_LINKS = [
  { href: "/settings/tokens/leader", label: "Leader ELD", icon: "/leader-eld.ico" },
  { href: "/settings/tokens/factor", label: "Factor ELD", icon: "/factor-eld.ico" },
  { href: "/settings/tokens/nexus", label: "Nexus ELD", icon: "/nexus-eld.ico" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#0b0e14]">
      <aside className="flex w-56 flex-col border-r border-slate-800 bg-[#0d1117] p-4">
        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600/20 text-sm font-bold text-blue-400">
            E
          </div>
          <span className="text-sm font-semibold text-slate-100">ELD Dashboard</span>
        </div>

        <nav className="flex-1 space-y-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-slate-100"
            >
              {link.label}
            </Link>
          ))}

          <p className="mt-6 px-3 text-xs font-medium uppercase tracking-wide text-slate-500">Provider Tokens</p>
          {PROVIDER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-slate-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={link.icon} alt="" className="h-4 w-4 rounded-sm" />
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-x-auto p-6">{children}</main>
    </div>
  );
}
