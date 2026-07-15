"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
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
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const el = buttonRefs.current[active];
    if (el) {
      setIndicatorStyle({ left: el.offsetLeft, width: el.offsetWidth });
    }
  }, [active]);

  function select(provider: Provider) {
    if (provider === active) return;
    setActive(provider);
    window.history.replaceState(null, "", `/?provider=${provider}`);
  }

  const activePanel = panels.find((p) => p.provider === active);

  return (
    <div>
      <div className="relative inline-flex rounded-full border border-violet-500/20 bg-[#0d1117] p-1">
        {indicatorStyle && (
          <div
            className="absolute inset-y-1 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 shadow-[0_0_16px_-2px_rgba(168,85,247,0.7)] transition-all duration-300 ease-out"
            style={{ left: indicatorStyle.left, width: indicatorStyle.width }}
          />
        )}
        {PROVIDERS.map((provider) => {
          const isActive = provider === active;
          return (
            <button
              key={provider}
              type="button"
              ref={(el) => {
                buttonRefs.current[provider] = el;
              }}
              onClick={() => select(provider)}
              className={`relative z-10 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold uppercase tracking-wide transition-colors duration-300 ${
                isActive ? "text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <ProviderIcon provider={provider} size="sm" />
              {PROVIDER_LABELS[provider]}
            </button>
          );
        })}
      </div>

      <div className="mt-6">{activePanel?.content}</div>
    </div>
  );
}
