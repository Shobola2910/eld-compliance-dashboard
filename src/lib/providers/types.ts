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
  providerLogId: string;
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
  ): Promise<{ logs: RawLogRecord[]; nextCursor: string | null }>;

  listViolations(
    credentials: ProviderCredentials,
    providerDriverId: string,
    opts: TimeWindowPageOpts
  ): Promise<{ violations: RawViolationRecord[]; nextCursor: string | null }>;

  certifyLogs(credentials: ProviderCredentials, providerLogIds: string[]): Promise<CertifyResult[]>;
}
