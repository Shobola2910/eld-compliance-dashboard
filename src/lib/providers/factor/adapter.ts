import { EldAdapter, PageOpts, TimeWindowPageOpts, ProviderCredentials, RawDriverRecord, RawViolationRecord } from "../types";

// Confirmed via browser DevTools (Network tab) against the real Factor ELD web app
// (app.factoreld.com): the frontend calls a separate API host, not its own domain.
const API_BASE = "https://api.drivehos.app";

interface FactorApiViolation {
  id: string;
  driver_id: string;
  violation_type: string;
  description: string | null;
  start_at: string;
  end_at: string | null;
  [key: string]: unknown;
}

interface FactorApiDriver {
  company_id: string;
  company_name: string;
  driver_id: string;
  driver_name: string;
  vehicle_number: string | null;
  current_status: string;
  last_sync: string | null;
  online: boolean;
  violations: FactorApiViolation[];
  shift: number;
  shift_max: number;
  drive: number;
  drive_max: number;
  break: number;
  break_max: number;
  cycle: number;
  cycle_max: number;
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

// Confirmed real via DevTools: GET /api/v1/hos/system-list returns EVERY driver across
// EVERY company under this account/tenant in one paginated list (not scoped per company),
// with each driver's company_id/company_name embedded, plus a live current_status,
// remaining Break/Drive/Shift/Cycle HOS snapshot (already computed by Factor, in
// milliseconds), and that driver's open violations -- all in one response.
//
// Since our EldAdapter interface is per-company (listDrivers(credentials, providerCompanyId)),
// we page through the whole system-list once, cache it for the lifetime of this module (i.e.
// this one serverless invocation's sync run), and filter/lookup from that cache -- avoiding
// re-fetching the same global list once per company and again per driver for violations.
let systemListCache: { key: string; drivers: FactorApiDriver[] } | null = null;

async function fetchSystemList(credentials: ProviderCredentials): Promise<FactorApiDriver[]> {
  const cacheKey = `${credentials.token}:${credentials.tenantId ?? ""}`;
  if (systemListCache && systemListCache.key === cacheKey) {
    return systemListCache.drivers;
  }

  const all: FactorApiDriver[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const json = await factorFetch(credentials, "/api/v1/hos/system-list", {
      page: String(page),
      limit: "100",
      eld_status: "all",
      duty_status: "all",
      online_status: "all",
      violation_status: "all",
      driver_status: "active",
      sort_by: "default",
      sort_order: "default",
    });
    const data = (json as { data?: { drivers?: FactorApiDriver[]; paging?: { totalPages?: number } } })?.data;
    all.push(...(data?.drivers ?? []));
    totalPages = data?.paging?.totalPages ?? 1;
    page += 1;
  } while (page <= totalPages);

  systemListCache = { key: cacheKey, drivers: all };
  return all;
}

function toRawDriverRecord(d: FactorApiDriver): RawDriverRecord {
  return {
    providerDriverId: d.driver_id,
    name: d.driver_name,
    truckNumber: d.vehicle_number ?? null,
    trailerNumber: null, // not present in this endpoint
    shippingDocsUpdatedAt: null, // not present in this endpoint -- profile freshness unknown until found
    connectionStatus: d.online ? "connected" : "disconnected",
    lastSeenAt: d.last_sync ?? null,
    raw: d,
    liveDutyStatus: d.current_status,
    liveHos: {
      breakRemainingMs: Math.max(0, d.break_max - d.break),
      driveRemainingMs: Math.max(0, d.drive_max - d.drive),
      shiftRemainingMs: Math.max(0, d.shift_max - d.shift),
      cycleRemainingMs: Math.max(0, d.cycle_max - d.cycle),
    },
  };
}

function toRawViolationRecord(v: FactorApiViolation): RawViolationRecord {
  return {
    providerViolationId: v.id,
    providerDriverId: v.driver_id,
    type: v.violation_type,
    occurredAt: v.start_at,
    resolvedAt: v.end_at,
    description: v.description,
    raw: v,
  };
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
    // Derived from the confirmed-working system-list response (every driver carries its
    // own company_id/company_name) instead of /api/v1/companies -- we've never actually
    // seen that endpoint's response body (only its request headers), so parseCompanyList's
    // guessed field names risked extracting the wrong/empty providerCompanyId, which would
    // silently collapse every company into one row (same empty id -> same unique-index key)
    // and explains companies/drivers not "all coming through". Sourcing from system-list
    // guarantees the ids match exactly what listDrivers/listViolations filter on.
    const all = await fetchSystemList(credentials);
    const byId = new Map<string, string>();
    for (const d of all) {
      if (!byId.has(d.company_id)) byId.set(d.company_id, d.company_name);
    }
    return Array.from(byId.entries()).map(([providerCompanyId, name]) => ({ providerCompanyId, name }));
  },

  async listDrivers(credentials: ProviderCredentials, providerCompanyId: string, _opts: PageOpts) {
    const all = await fetchSystemList(credentials);
    const drivers = all.filter((d) => d.company_id === providerCompanyId).map(toRawDriverRecord);
    // The whole company's drivers come back resolved in one call (we've already
    // paged through Factor's own pagination internally), so there's no further cursor.
    return { drivers, nextCursor: null };
  },

  // Not available from system-list -- still need the real HOS logs endpoint
  // (open a driver's logs in app.factoreld.com and capture the Network request).
  async listLogs(_credentials: ProviderCredentials, _providerDriverId: string, _opts: TimeWindowPageOpts) {
    return { logs: [], nextCursor: null };
  },

  async listViolations(credentials: ProviderCredentials, providerDriverId: string, _opts: TimeWindowPageOpts) {
    const all = await fetchSystemList(credentials);
    const driver = all.find((d) => d.driver_id === providerDriverId);
    const violations = (driver?.violations ?? []).map(toRawViolationRecord);
    return { violations, nextCursor: null };
  },

  // TODO: capture the certify action's endpoint before filling this in.
  async certifyLogs() {
    throw new Error(
      "factorEldAdapter.certifyLogs not implemented -- need the real certify endpoint (click Certify on a log in app.factoreld.com and capture the Network request)"
    );
  },
};
