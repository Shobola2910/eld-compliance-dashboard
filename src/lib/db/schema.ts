import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const providerEnum = pgEnum("provider", ["leader", "factor", "nexus"]);

export const connectionStatusEnum = pgEnum("connection_status", [
  "connected",
  "disconnected",
  "unknown",
]);

export const certifyStatusEnum = pgEnum("certify_status", [
  "pending",
  "auto_certified",
  "manually_certified",
  "failed",
]);

export const violationTypeEnum = pgEnum("violation_type", [
  "drive_time",
  "duty_time",
  "break_required",
  "cycle_limit",
  "unidentified_driving",
  "other",
]);

export const alertTypeEnum = pgEnum("alert_type", [
  "disconnect",
  "reconnect",
  "stale_profile",
  "sync_failed",
]);

export const syncStatusEnum = pgEnum("sync_status", [
  "running",
  "success",
  "partial",
  "failed",
]);

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  provider: providerEnum("provider").notNull(),
  providerCompanyId: text("provider_company_id").notNull(),
  timezone: text("timezone").default("America/Chicago"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  providerCompanyIdx: uniqueIndex("companies_provider_company_idx").on(t.provider, t.providerCompanyId),
}));

// One token per PROVIDER (not per company) -- a single Leader/Factor/Nexus
// bearer token grants access to every company & driver visible under that
// provider account, discovered via adapter.listCompanies().
export const providerTokens = pgTable("provider_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: providerEnum("provider").notNull(),
  encryptedToken: text("encrypted_token").notNull(),
  iv: text("iv").notNull(),
  authTag: text("auth_tag").notNull(),
  // Not every provider needs this -- Factor ELD requires a stable per-account
  // tenant_id header alongside the bearer token, others don't use it at all.
  // Not a secret on its own (just an account identifier), so stored in plain text.
  tenantId: text("tenant_id"),
  tokenVersion: text("token_version").default("v2").notNull(),
  isValid: boolean("is_valid").default(true).notNull(),
  lastValidatedAt: timestamp("last_validated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  providerIdx: uniqueIndex("provider_tokens_provider_idx").on(t.provider),
}));

export const drivers = pgTable("drivers", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  provider: providerEnum("provider").notNull(),
  providerDriverId: text("provider_driver_id").notNull(),
  name: text("name").notNull(),
  truckNumber: text("truck_number"),
  trailerNumber: text("trailer_number"),
  shippingDocsUpdatedAt: timestamp("shipping_docs_updated_at", { withTimezone: true }),
  trailerNumberUpdatedAt: timestamp("trailer_number_updated_at", { withTimezone: true }),
  profileLastCheckedAt: timestamp("profile_last_checked_at", { withTimezone: true }),
  connectionStatus: connectionStatusEnum("connection_status").default("unknown").notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  companyProviderDriverIdx: uniqueIndex("drivers_company_provider_driver_idx").on(
    t.companyId,
    t.provider,
    t.providerDriverId
  ),
  companyProviderIdx: index("drivers_company_provider_idx").on(t.companyId, t.provider),
}));

export const normalizedLogs = pgTable("normalized_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  driverId: uuid("driver_id").notNull().references(() => drivers.id, { onDelete: "cascade" }),
  provider: providerEnum("provider").notNull(),
  providerLogId: text("provider_log_id").notNull(),
  dutyStatus: text("duty_status").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  odometer: numeric("odometer"),
  originLat: numeric("origin_lat"),
  originLng: numeric("origin_lng"),
  certifyStatus: certifyStatusEnum("certify_status").default("pending").notNull(),
  certifiedAt: timestamp("certified_at", { withTimezone: true }),
  rawPayload: jsonb("raw_payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  driverProviderLogIdx: uniqueIndex("normalized_logs_driver_provider_log_idx").on(
    t.driverId,
    t.provider,
    t.providerLogId
  ),
  driverStartedIdx: index("normalized_logs_driver_started_idx").on(t.driverId, t.startedAt),
}));

export const violations = pgTable("violations", {
  id: uuid("id").primaryKey().defaultRandom(),
  driverId: uuid("driver_id").notNull().references(() => drivers.id, { onDelete: "cascade" }),
  normalizedLogId: uuid("normalized_log_id").references(() => normalizedLogs.id, { onDelete: "set null" }),
  provider: providerEnum("provider").notNull(),
  providerViolationId: text("provider_violation_id").notNull(),
  type: violationTypeEnum("type").notNull(),
  severity: text("severity"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  description: text("description"),
  rawPayload: jsonb("raw_payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  driverProviderViolationIdx: uniqueIndex("violations_driver_provider_violation_idx").on(
    t.driverId,
    t.provider,
    t.providerViolationId
  ),
  driverOccurredIdx: index("violations_driver_occurred_idx").on(t.driverId, t.occurredAt),
  openIdx: index("violations_open_idx").on(t.resolvedAt),
}));

export const connectionEvents = pgTable("connection_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  driverId: uuid("driver_id").notNull().references(() => drivers.id, { onDelete: "cascade" }),
  status: connectionStatusEnum("status").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  detectedAt: timestamp("detected_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  driverIdx: index("connection_events_driver_idx").on(t.driverId, t.occurredAt),
}));

export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  driverId: uuid("driver_id").references(() => drivers.id, { onDelete: "cascade" }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  type: alertTypeEnum("type").notNull(),
  message: text("message").notNull(),
  severity: text("severity").default("warning").notNull(),
  triggeredAt: timestamp("triggered_at", { withTimezone: true }).defaultNow().notNull(),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  openIdx: index("alerts_open_idx").on(t.acknowledgedAt),
  driverTypeIdx: index("alerts_driver_type_idx").on(t.driverId, t.type),
}));

export const syncRuns = pgTable("sync_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  provider: providerEnum("provider").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: syncStatusEnum("status").default("running").notNull(),
  driversProcessed: integer("drivers_processed").default(0).notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  companyIdx: index("sync_runs_company_idx").on(t.companyId, t.startedAt),
}));
