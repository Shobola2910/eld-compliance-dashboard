import Link from "next/link";
import { PROVIDERS, PROVIDER_LABELS } from "@/lib/providers/registry";
import type { Provider } from "@/lib/providers/types";

const PROVIDER_ICONS: Record<Provider, string> = {
  leader: "/leader-eld.ico",
  factor: "/factor-eld.ico",
  nexus: "/nexus-eld.ico",
};

export default function ProviderTabs({ active }: { active: Provider }) {
  return (
    <div className="inline-flex rounded-full border border-slate-800 bg-[#0d1117] p-1">
      {PROVIDERS.map((provider) => {
        const isActive = provider === active;
        return (
          <Link
            key={provider}
            href={`/?provider=${provider}`}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold uppercase tracking-wide transition ${
              isActive
                ? "bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={PROVIDER_ICONS[provider]} alt="" className="h-4 w-4 rounded-sm" />
            {PROVIDER_LABELS[provider]}
          </Link>
        );
      })}
    </div>
  );
}
