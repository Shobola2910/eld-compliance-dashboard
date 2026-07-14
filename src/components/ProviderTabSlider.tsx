"use client";

import { useState, type ReactNode } from "react";
import { PROVIDERS, PROVIDER_LABELS } from "@/lib/providers/registry";
import type { Provider } from "@/lib/providers/types";
import ProviderIcon from "@/components/ProviderIcon";

export interface ProviderPanel {
  provider: Provider;
  content: ReactNode;
}

export default function ProviderTabSlider({
  initialProvider,
  panels,
}: {
  initialProvider: Provider;
  panels: ProviderPanel[];
}) {
  const [active, setActive] = useState<Provider>(initialProvider);
  const activeIndex = PROVIDERS.indexOf(active);

  function select(provider: Provider) {
    if (provider === active) return;
    setActive(provider);
    window.history.replaceState(null, "", `/?provider=${provider}`);
  }

  return (
    <div>
      <div className="inline-flex rounded-full border border-slate-800 bg-[#0d1117] p-1">
        {PROVIDERS.map((provider) => {
          const isActive = provider === active;
          return (
            <button
              key={provider}
              type="button"
              onClick={() => select(provider)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold uppercase tracking-wide transition-all duration-300 ${
                isActive
                  ? "bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <ProviderIcon provider={provider} size="sm" />
              {PROVIDER_LABELS[provider]}
            </button>
          );
        })}
      </div>

      <div className="mt-6 overflow-hidden">
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {panels.map((panel) => (
            <div key={panel.provider} className="w-full shrink-0">
              {panel.content}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
