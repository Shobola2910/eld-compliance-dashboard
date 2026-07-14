import { EldAdapter, PageOpts, TimeWindowPageOpts } from "../types";

// TODO: replace with real Factor ELD API calls once endpoint docs are available.
export const factorEldAdapter: EldAdapter = {
  provider: "factor",

  async validateToken() {
    throw new Error("factorEldAdapter.validateToken not implemented -- ELD_MODE=live requires real API docs");
  },

  async listCompanies() {
    throw new Error("factorEldAdapter.listCompanies not implemented");
  },

  async listDrivers(_token: string, _providerCompanyId: string, _opts: PageOpts) {
    throw new Error("factorEldAdapter.listDrivers not implemented");
  },

  async listLogs(_token: string, _providerDriverId: string, _opts: TimeWindowPageOpts) {
    throw new Error("factorEldAdapter.listLogs not implemented");
  },

  async listViolations(_token: string, _providerDriverId: string, _opts: TimeWindowPageOpts) {
    throw new Error("factorEldAdapter.listViolations not implemented");
  },

  async certifyLogs() {
    throw new Error("factorEldAdapter.certifyLogs not implemented");
  },
};
