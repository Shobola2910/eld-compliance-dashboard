import { EldAdapter, Provider } from "./types";
import { leaderMockAdapter } from "./leader/mock";
import { factorMockAdapter } from "./factor/mock";
import { nexusMockAdapter } from "./nexus/mock";
import { leaderEldAdapter } from "./leader/adapter";
import { factorEldAdapter } from "./factor/adapter";
import { nexusEldAdapter } from "./nexus/adapter";

const mockAdapters: Record<Provider, EldAdapter> = {
  leader: leaderMockAdapter,
  factor: factorMockAdapter,
  nexus: nexusMockAdapter,
};

const liveAdapters: Record<Provider, EldAdapter> = {
  leader: leaderEldAdapter,
  factor: factorEldAdapter,
  nexus: nexusEldAdapter,
};

export function getAdapter(provider: Provider): EldAdapter {
  // Per-provider override (e.g. ELD_MODE_FACTOR=live) takes precedence over the global ELD_MODE,
  // so one provider can go live while the others stay on mock data.
  const override = process.env[`ELD_MODE_${provider.toUpperCase()}`];
  const mode = override ?? process.env.ELD_MODE ?? "mock";
  return mode === "live" ? liveAdapters[provider] : mockAdapters[provider];
}

export const PROVIDER_LABELS: Record<Provider, string> = {
  leader: "Leader ELD",
  factor: "Factor ELD",
  nexus: "Nexus ELD",
};

export const PROVIDERS: Provider[] = ["leader", "factor", "nexus"];
