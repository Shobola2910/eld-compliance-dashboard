import {
  EldAdapter,
  Provider,
  RawDriverRecord,
  RawLogRecord,
  RawViolationRecord,
  CertifyResult,
  PageOpts,
  TimeWindowPageOpts,
  ProviderCredentials,
} from "../types";
import { seedFromString, createRng, pick } from "./rng";

const FIRST_NAMES = ["James", "Maria", "Carlos", "Aibek", "Elena", "David", "Sofia", "Umar", "Grace", "Ivan", "Anna", "Bekzod"];
const LAST_NAMES = ["Rivera", "Smith", "Karimov", "Johnson", "Lopez", "Kim", "Nazarov", "Brown", "Petrov", "Garcia", "Tashkentov", "Miller"];

const DRIVERS_PER_COMPANY = 10;
const CONNECTION_BUCKET_MS = 10 * 60 * 1000; // status can flip roughly every 10 minutes

export interface DutyStatusVocab {
  driving: string;
  onDuty: string;
  offDuty: string;
  sleeper: string;
}

export interface ViolationVocab {
  driveTime: string;
  dutyTime: string;
  breakRequired: string;
  cycleLimit: string;
}

export interface MockAdapterConfig {
  provider: Provider;
  companyNames: string[];
  dutyStatusVocab: DutyStatusVocab;
  violationVocab: ViolationVocab;
}

function buildDriver(config: MockAdapterConfig, providerCompanyId: string, index: number): RawDriverRecord {
  const rng = createRng(seedFromString(`${config.provider}:${providerCompanyId}:driver:${index}`));
  const name = `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`;
  const providerDriverId = `${providerCompanyId}-drv-${index}`;

  const bucket = Math.floor(Date.now() / CONNECTION_BUCKET_MS);
  const isFlappy = index % 5 === 0;
  const connectionStatus: RawDriverRecord["connectionStatus"] = isFlappy
    ? (bucket + index) % 3 === 0
      ? "disconnected"
      : "connected"
    : "connected";

  const isStaleProfile = index % 4 === 0;
  const shippingDocsUpdatedAt = new Date(
    Date.now() - (isStaleProfile ? 5 : 1) * 24 * 60 * 60 * 1000 - rng() * 12 * 60 * 60 * 1000
  );

  const lastSeenAt =
    connectionStatus === "disconnected"
      ? new Date(Date.now() - (30 + Math.floor(rng() * 90)) * 60 * 1000)
      : new Date(Date.now() - Math.floor(rng() * 5) * 60 * 1000);

  return {
    providerDriverId,
    name,
    truckNumber: `T-${100 + index}`,
    trailerNumber: `TR-${2000 + index * 7}`,
    shippingDocsUpdatedAt: shippingDocsUpdatedAt.toISOString(),
    connectionStatus,
    lastSeenAt: lastSeenAt.toISOString(),
    raw: { mock: true, provider: config.provider, index },
  };
}

export function createMockAdapter(config: MockAdapterConfig): EldAdapter {
  return {
    provider: config.provider,

    async validateToken({ token }: ProviderCredentials) {
      if (!token || token.trim().length < 4) {
        return { valid: false, reason: "Token looks too short" };
      }
      if (token === "invalid") {
        return { valid: false, reason: "Token rejected by provider" };
      }
      return { valid: true };
    },

    async listCompanies() {
      return config.companyNames.map((name, i) => ({
        providerCompanyId: `${config.provider}-co-${i + 1}`,
        name,
      }));
    },

    async listDrivers(_credentials: ProviderCredentials, providerCompanyId: string, opts: PageOpts) {
      const offset = opts.cursor ? parseInt(opts.cursor, 10) : 0;
      const all = Array.from({ length: DRIVERS_PER_COMPANY }, (_, i) => buildDriver(config, providerCompanyId, i));
      const page = all.slice(offset, offset + opts.pageSize);
      const nextOffset = offset + opts.pageSize;
      return {
        drivers: page,
        nextCursor: nextOffset < all.length ? String(nextOffset) : null,
      };
    },

    async listLogs(_credentials: ProviderCredentials, providerDriverId: string, opts: TimeWindowPageOpts) {
      const rng = createRng(seedFromString(`${config.provider}:${providerDriverId}:logs:${opts.since.toISOString()}`));
      const statuses = [
        config.dutyStatusVocab.offDuty,
        config.dutyStatusVocab.onDuty,
        config.dutyStatusVocab.driving,
        config.dutyStatusVocab.driving,
        config.dutyStatusVocab.onDuty,
        config.dutyStatusVocab.sleeper,
      ];

      const windowMs = opts.until.getTime() - opts.since.getTime();
      const segmentCount = 4 + Math.floor(rng() * 3);
      const logs: RawLogRecord[] = [];
      let cursorTime = opts.since.getTime();

      for (let i = 0; i < segmentCount; i++) {
        const remaining = opts.until.getTime() - cursorTime;
        if (remaining <= 0) break;
        const segmentMs = Math.min(remaining, Math.max(windowMs / (segmentCount * 2), rng() * windowMs) / segmentCount + rng() * windowMs * 0.05);
        const startedAt = new Date(cursorTime);
        const endedAt = new Date(cursorTime + segmentMs);
        logs.push({
          providerLogId: `${providerDriverId}-log-${opts.since.getTime()}-${i}`,
          providerDriverId,
          dutyStatus: statuses[i % statuses.length],
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
          odometer: 50000 + Math.floor(rng() * 20000) + i * 40,
          location: { lat: 39 + rng() * 8, lng: -104 + rng() * 10 },
          raw: { mock: true, provider: config.provider },
        });
        cursorTime += segmentMs;
      }

      return { logs, nextCursor: null };
    },

    async listViolations(_credentials: ProviderCredentials, providerDriverId: string, opts: TimeWindowPageOpts) {
      const rng = createRng(seedFromString(`${config.provider}:${providerDriverId}:violations`));
      const driverIndexMatch = providerDriverId.match(/-drv-(\d+)$/);
      const index = driverIndexMatch ? parseInt(driverIndexMatch[1], 10) : 0;

      if (index % 3 !== 0) {
        return { violations: [], nextCursor: null };
      }

      const types = [
        config.violationVocab.driveTime,
        config.violationVocab.dutyTime,
        config.violationVocab.breakRequired,
        config.violationVocab.cycleLimit,
      ];

      const occurredAt = new Date(
        opts.since.getTime() + rng() * (opts.until.getTime() - opts.since.getTime())
      );

      const violation: RawViolationRecord = {
        providerViolationId: `${providerDriverId}-vio-${occurredAt.getTime()}`,
        providerDriverId,
        type: pick(rng, types),
        occurredAt: occurredAt.toISOString(),
        resolvedAt: null,
        description: "Auto-generated mock violation for UI testing",
        raw: { mock: true, provider: config.provider },
      };

      return { violations: [violation], nextCursor: null };
    },

    async certifyLogs(_credentials: ProviderCredentials, providerLogIds: string[]): Promise<CertifyResult[]> {
      return providerLogIds.map((providerLogId) => ({
        providerLogId,
        success: true,
        certifiedAt: new Date().toISOString(),
      }));
    },
  };
}
