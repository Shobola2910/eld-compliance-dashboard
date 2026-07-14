import { EldAdapter, PageOpts, TimeWindowPageOpts, ProviderCredentials } from "../types";

// TODO: replace with real Leader ELD API calls once endpoint docs are available.
// Keep the method signatures identical to EldAdapter so lib/providers/registry.ts
// is the only place that needs to change to go live.
export const leaderEldAdapter: EldAdapter = {
  provider: "leader",

  async validateToken() {
    throw new Error("leaderEldAdapter.validateToken not implemented -- ELD_MODE=live requires real API docs");
  },

  async listCompanies() {
    throw new Error("leaderEldAdapter.listCompanies not implemented");
  },

  async listDrivers(_credentials: ProviderCredentials, _providerCompanyId: string, _opts: PageOpts) {
    throw new Error("leaderEldAdapter.listDrivers not implemented");
  },

  async listLogs(_credentials: ProviderCredentials, _providerDriverId: string, _opts: TimeWindowPageOpts) {
    throw new Error("leaderEldAdapter.listLogs not implemented");
  },

  async listViolations(_credentials: ProviderCredentials, _providerDriverId: string, _opts: TimeWindowPageOpts) {
    throw new Error("leaderEldAdapter.listViolations not implemented");
  },

  async certifyLogs() {
    throw new Error("leaderEldAdapter.certifyLogs not implemented");
  },
};
