import { EldAdapter, PageOpts, TimeWindowPageOpts, ProviderCredentials, RawDriverRecord, RawLogRecord, RawViolationRecord } from "../types";

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

interface FactorApiCompany {
  id: number;
  company_id: string;
  company_name: string;
  active_driver: number;
  [key: string]: unknown;
}

interface FactorApiEvent {
  id: string;
  driver_id: string;
  event_code: string;
  event_start_time: string;
  event_end_time: string | null;
  odometer: number | null;
  lat: number | null;
  lon: number | null;
  trailers: string;
  shipping_docs: string;
  [key: string]: unknown;
}

// Confirmed real via DevTools (clicking into a driver's log page): GET /api/v1/events
// returns EVERY event for that driver in the range, not just duty-status changes --
// engine on/off, certification markers (DR_CERT_1), login/logout, etc. are mixed in.
// Only these four represent an actual duty-status segment for HOS purposes.
const DUTY_EVENT_CODES = new Set(["DS_D", "DS_ON", "DS_OFF", "DS_SB"]);

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

async function factorPost(
  { token, tenantId }: ProviderCredentials,
  path: string,
  body: Record<string, unknown>
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (tenantId) {
    headers.tenant_id = tenantId;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Factor ELD API ${res.status} on ${path}: ${await res.text().catch(() => "")}`);
  }

  return res.json();
}

// Derives the driver's CURRENT trailer#/shipping-docs and (best-effort) when
// that value last changed, by walking the full (unfiltered) event history
// oldest-first and tracking the most recent value-change per field. If the
// value hasn't changed anywhere in the fetched window, the "updated at" we
// report is just the oldest event we saw -- an honest lower bound ("at least
// this old"), not a false-precise timestamp; still correct enough to trigger
// the 3-day staleness alert.
function deriveDriverMeta(events: FactorApiEvent[]): { trailerNumber: string | null; shippingDocsUpdatedAt: string | null } {
  const sorted = [...events].sort((a, b) => a.event_start_time.localeCompare(b.event_start_time));

  let trailerNumber: string | null = null;
  let shippingDocsUpdatedAt: string | null = null;
  let lastShippingDocs: string | undefined;

  for (const e of sorted) {
    if (e.trailers) trailerNumber = e.trailers;
    if (e.shipping_docs && e.shipping_docs !== lastShippingDocs) {
      shippingDocsUpdatedAt = e.event_start_time;
      lastShippingDocs = e.shipping_docs;
    }
  }

  return { trailerNumber, shippingDocsUpdatedAt };
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
    // Now confirmed real (previously guessed field names extracted an empty
    // providerCompanyId for every company, which is why companies/drivers weren't "all
    // coming through" -- they collided onto one row). Real shape:
    // { data: { companies: [{ id: <numeric internal id>, company_id: <uuid>, company_name, ... }], paging } }.
    // company_id (the UUID) is what listDrivers/listViolations's system-list rows use too --
    // NOT the numeric `id` field, which is a different internal identifier.
    // Paginated at a small page size (the real frontend uses 20) across potentially many
    // pages (101 companies / 6 pages seen for this account) -- page through all of them,
    // including companies with zero active drivers (system-list alone would have missed those).
    const all: { providerCompanyId: string; name: string }[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const json = await factorFetch(credentials, "/api/v1/companies", {
        status: "active",
        limit: "100",
        page: String(page),
        group: "all",
      });
      const data = (json as { data?: { companies?: FactorApiCompany[]; paging?: { totalPages?: number } } })?.data;
      for (const c of data?.companies ?? []) {
        all.push({ providerCompanyId: c.company_id, name: c.company_name });
      }
      totalPages = data?.paging?.totalPages ?? 1;
      page += 1;
    } while (page <= totalPages);

    return all;
  },

  async listDrivers(credentials: ProviderCredentials, providerCompanyId: string, _opts: PageOpts) {
    const all = await fetchSystemList(credentials);
    const drivers = all.filter((d) => d.company_id === providerCompanyId).map(toRawDriverRecord);
    // The whole company's drivers come back resolved in one call (we've already
    // paged through Factor's own pagination internally), so there's no further cursor.
    return { drivers, nextCursor: null };
  },

  // Confirmed real via DevTools: GET /api/v1/events?driver_id=&start_date=&end_date=
  // returns every event (not paginated) for that driver in the window -- duty-status
  // changes plus engine/cert/login noise mixed in. Also carries current trailer#/
  // shipping-docs on each event, which system-list doesn't have -- see deriveDriverMeta.
  async listLogs(credentials: ProviderCredentials, providerDriverId: string, opts: TimeWindowPageOpts) {
    const json = await factorFetch(credentials, "/api/v1/events", {
      driver_id: providerDriverId,
      start_date: opts.since.toISOString(),
      end_date: opts.until.toISOString(),
      timezone: "America/New_York",
    });
    // Confirmed real-world case: at least some events come back with no
    // event_start_time at all -- without this filter, sorting/comparing on it
    // (here and in deriveDriverMeta) throws and drops the whole driver's sync.
    const events = ((json as { data?: { events?: FactorApiEvent[] } })?.data?.events ?? []).filter(
      (e) => typeof e.event_start_time === "string"
    );

    const logs: RawLogRecord[] = events
      .filter((e) => DUTY_EVENT_CODES.has(e.event_code))
      .map((e) => ({
        providerLogId: e.id,
        providerDriverId: e.driver_id,
        dutyStatus: e.event_code,
        startedAt: e.event_start_time,
        endedAt: e.event_end_time,
        odometer: e.odometer,
        location: e.lat != null && e.lon != null ? { lat: e.lat, lng: e.lon } : null,
        raw: e,
      }));

    return { logs, nextCursor: null, driverMeta: deriveDriverMeta(events) };
  },

  async listViolations(credentials: ProviderCredentials, providerDriverId: string, _opts: TimeWindowPageOpts) {
    const all = await fetchSystemList(credentials);
    const driver = all.find((d) => d.driver_id === providerDriverId);
    const violations = (driver?.violations ?? []).map(toRawViolationRecord);
    return { violations, nextCursor: null };
  },

  // Confirmed real via DevTools: POST /api/v1/events/bulk-certification with
  // {driver_id, start_date, end_date} -- certifies every day in that range for
  // that driver in one call (no per-log-id concept on Factor's side; re-running
  // over an already-certified range is safe, it only adds DR_CERT_1 markers for
  // days that don't have one yet).
  async certifyLogs(credentials: ProviderCredentials, providerDriverId: string, opts: { since: Date; until: Date }) {
    try {
      await factorPost(credentials, "/api/v1/events/bulk-certification", {
        driver_id: providerDriverId,
        start_date: opts.since.toISOString(),
        end_date: opts.until.toISOString(),
      });
      return { success: true, certifiedAt: new Date().toISOString() };
    } catch (err) {
      return { success: false, errorMessage: (err as Error).message };
    }
  },

  // NOTE on "Normalize" (POST /api/v1/events/normalizer): the endpoint itself is
  // confirmed via DevTools, but deliberately NOT wired up here. Unlike Certify,
  // Normalize submits a specific corrected odometer/engine_hours value at a given
  // seq_id -- it's meant to fix a real ECM/odometer discrepancy, and the correct
  // value has to come from somewhere trustworthy (a flagged diagnostic error, the
  // vehicle's real current reading, etc). The captured example had no matching
  // error/malfunction for that driver, so those numbers were just manual test
  // input, not a real correction. Auto-submitting an unverified value here would
  // write incorrect data into an official DOT compliance record. Decided with the
  // user (2026-07-15): leave unimplemented until a real anomaly case is captured.
};
