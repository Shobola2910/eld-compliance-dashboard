export type Provider = "leader" | "factor" | "nexus";

export interface RawDriverRecord {
  providerDriverId: string;
  name: string;
  truckNumber: string | null;
  trailerNumber: string | null;
  shippingDocsUpdatedAt: string | null; // ISO timestamp
  connectionStatus: "connected" | "disconnected" | "unknown";
  lastSeenAt: string | null; // ISO timestamp
  raw: unknown;
  // Some providers (e.g. Factor ELD) hand back a live current-status +
  // remaining-HOS-time snapshot directly from their own system, computed
  // more authoritatively than we could from raw logs alone (especially
  // before we have listLogs history for that provider). When present, the
  // UI/pipeline should prefer this over our own computeHosStatus().
  liveDutyStatus?: string; // provider vocabulary, normalized before storage
  liveHos?: {
    breakRemainingMs: number;
    driveRemainingMs: number;
    shiftRemainingMs: number;
    cycleRemainingMs: number;
  };
}

export interface RawLogRecord {
  providerLogId: string;
  providerDriverId: string;
  dutyStatus: string; // provider's own vocabulary -- mapped in lib/pipeline/normalize.ts
  startedAt: string; // ISO timestamp
  endedAt: string | null; // ISO timestamp
  odometer: number | null;
  location: { lat: number; lng: number } | null;
  raw: unknown;
}

export interface RawViolationRecord {
  providerViolationId: string;
  providerDriverId: string;
  type: string; // provider vocabulary -- mapped in lib/pipeline/normalize.ts
  occurredAt: string; // ISO timestamp
  resolvedAt: string | null;
  description: string | null;
  raw: unknown;
}

export interface CertifyResult {
  success: boolean;
  certifiedAt?: string;
  errorMessage?: string;
}

export interface PageOpts {
  cursor?: string;
  pageSize: number;
}

export interface TimeWindowPageOpts extends PageOpts {
  since: Date;
  until: Date;
}

// Some providers (e.g. Factor ELD) need more than just a bearer token on every
// request -- Factor also requires a stable per-account `tenant_id` header.
// tenantId is optional so providers that don't need it can ignore it.
export interface ProviderCredentials {
  token: string;
  tenantId?: string;
}

export interface EldAdapter {
  readonly provider: Provider;

  validateToken(credentials: ProviderCredentials): Promise<{ valid: boolean; reason?: string }>;

  listCompanies(credentials: ProviderCredentials): Promise<{ providerCompanyId: string; name: string }[]>;

  listDrivers(
    credentials: ProviderCredentials,
    providerCompanyId: string,
    opts: PageOpts
  ): Promise<{ drivers: RawDriverRecord[]; nextCursor: string | null }>;

  listLogs(
    credentials: ProviderCredentials,
    providerDriverId: string,
    opts: TimeWindowPageOpts
  ): Promise<{
    logs: RawLogRecord[];
    nextCursor: string | null;
    // Some providers only expose current trailer#/shipping-docs (and when they
    // last changed) via the same event-history payload used for logs, not via
    // listDrivers -- an optional side channel so the pipeline can enrich the
    // driver row without a second API call. Providers that already return
    // these on RawDriverRecord from listDrivers can just omit this.
    driverMeta?: { trailerNumber?: string | null; shippingDocsUpdatedAt?: string | null };
  }>;

  listViolations(
    credentials: ProviderCredentials,
    providerDriverId: string,
    opts: TimeWindowPageOpts
  ): Promise<{ violations: RawViolationRecord[]; nextCursor: string | null }>;

  // Providers differ on whether "certify" targets specific log ids or a
  // driver+date-range (Factor ELD's real bulk-certification endpoint is the
  // latter -- it has no concept of certifying an individual log id).
  // Modeling it as driver+range covers both: a range-less provider can just
  // certify every log whose startedAt falls in [since, until] on its side.
  certifyLogs(
    credentials: ProviderCredentials,
    providerDriverId: string,
    opts: { since: Date; until: Date }
  ): Promise<CertifyResult>;
}
