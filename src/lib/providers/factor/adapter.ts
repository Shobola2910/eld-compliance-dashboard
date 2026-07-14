import { EldAdapter, PageOpts, TimeWindowPageOpts, ProviderCredentials } from "../types";

// Confirmed via browser DevTools (Network tab) against the real Factor ELD web app
// (app.factoreld.com): the frontend calls a separate API host, not its own domain.
const API_BASE = "https://api.drivehos.app";

interface FactorApiCompany {
  id?: string | number;
  companyId?: string | number;
  dotNumber?: string | number;
  name?: string;
  companyName?: string;
  [key: string]: unknown;
}

async function factorFetch(
  { token, tenantId }: ProviderCredentials,
  path: string,
  params?: Record<string, string>
) {
  const url = new URL(`${API_BASE}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
  // Confirmed required -- without it the API returns 400 "Missing 'tenant_id' in header".
  if (tenantId) {
    headers.tenant_id = tenantId;
  }

  const res = await fetch(url, { headers });

  if (!res.ok) {
    throw new Error(`Factor ELD API ${res.status} on ${path}: ${await res.text().catch(() => "")}`);
  }

  return res.json();
}

// Best-effort: the request shape (GET /api/v1/companies?status=active&limit=N&page=1&group=all,
// Bearer + tenant_id headers) is confirmed from a captured request, but the exact response JSON
// field names were not visible in that capture (only headers were shown) -- this parses
// defensively across a few likely shapes. Verify against a real response body and adjust field
// names if this is off.
function parseCompanyList(json: unknown): { providerCompanyId: string; name: string }[] {
  const list: FactorApiCompany[] = Array.isArray(json)
    ? json
    : ((json as { data?: FactorApiCompany[]; companies?: FactorApiCompany[] })?.data ??
       (json as { companies?: FactorApiCompany[] })?.companies ??
       []);

  return list.map((c) => ({
    providerCompanyId: String(c.id ?? c.companyId ?? c.dotNumber ?? ""),
    name: c.name ?? c.companyName ?? "Unknown company",
  }));
}

export const factorEldAdapter: EldAdapter = {
  provider: "factor",

  async validateToken(credentials: ProviderCredentials) {
    if (!credentials.tenantId) {
      return {
        valid: false,
        reason: "Factor ELD also requires a tenant_id (see the tenant_id request header in DevTools), not just a token",
      };
    }
    try {
      await factorFetch(credentials, "/api/v1/companies", { status: "active", limit: "1", page: "1", group: "all" });
      return { valid: true };
    } catch (err) {
      return { valid: false, reason: (err as Error).message };
    }
  },

  async listCompanies(credentials: ProviderCredentials) {
    const json = await factorFetch(credentials, "/api/v1/companies", {
      status: "active",
      limit: "200",
      page: "1",
      group: "all",
    });
    return parseCompanyList(json);
  },

  // TODO: capture the real request -- open a company in app.factoreld.com, click its Drivers
  // tab, and check the Network tab for the endpoint + response shape, then fill this in.
  async listDrivers(_credentials: ProviderCredentials, _providerCompanyId: string, _opts: PageOpts) {
    throw new Error(
      "factorEldAdapter.listDrivers not implemented -- need the real drivers-list endpoint (open a company's Drivers tab in app.factoreld.com and capture the Network request)"
    );
  },

  // TODO: capture the HOS logs endpoint (open a driver's logs view) before filling this in.
  async listLogs(_credentials: ProviderCredentials, _providerDriverId: string, _opts: TimeWindowPageOpts) {
    throw new Error(
      "factorEldAdapter.listLogs not implemented -- need the real HOS logs endpoint (open a driver's logs in app.factoreld.com and capture the Network request)"
    );
  },

  // TODO: capture the violations endpoint before filling this in.
  async listViolations(_credentials: ProviderCredentials, _providerDriverId: string, _opts: TimeWindowPageOpts) {
    throw new Error(
      "factorEldAdapter.listViolations not implemented -- need the real violations endpoint (open a driver's violations view in app.factoreld.com and capture the Network request)"
    );
  },

  // TODO: capture the certify action's endpoint before filling this in.
  async certifyLogs() {
    throw new Error(
      "factorEldAdapter.certifyLogs not implemented -- need the real certify endpoint (click Certify on a log in app.factoreld.com and capture the Network request)"
    );
  },
};
