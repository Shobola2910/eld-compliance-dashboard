import { EldAdapter, PageOpts, TimeWindowPageOpts, ProviderCredentials } from "../types";

// TODO: replace with real Nexus ELD API calls once endpoint docs are available.
export const nexusEldAdapter: EldAdapter = {
  provider: "nexus",

  async validateToken() {
    throw new Error("nexusEldAdapter.validateToken not implemented -- ELD_MODE=live requires real API docs");
  },

  async listCompanies() {
    throw new Error("nexusEldAdapter.listCompanies not implemented");
  },

  async listDrivers(_credentials: ProviderCredentials, _providerCompanyId: string, _opts: PageOpts) {
    throw new Error("nexusEldAdapter.listDrivers not implemented");
  },

  async listLogs(_credentials: ProviderCredentials, _providerDriverId: string, _opts: TimeWindowPageOpts) {
    throw new Error("nexusEldAdapter.listLogs not implemented");
  },

  async listViolations(_credentials: ProviderCredentials, _providerDriverId: string, _opts: TimeWindowPageOpts) {
    throw new Error("nexusEldAdapter.listViolations not implemented");
  },

  async certifyLogs() {
    throw new Error("nexusEldAdapter.certifyLogs not implemented");
  },
};
