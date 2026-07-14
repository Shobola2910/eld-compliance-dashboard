import { Provider } from "../providers/types";

// Canonical duty-status vocabulary used across the whole app, regardless of
// which ELD provider a log came from.
export type NormalizedDutyStatus = "driving" | "on_duty" | "off_duty" | "sleeper_berth";

export type NormalizedViolationType =
  | "drive_time"
  | "duty_time"
  | "break_required"
  | "cycle_limit"
  | "unidentified_driving"
  | "other";

const DUTY_STATUS_MAPS: Record<Provider, Record<string, NormalizedDutyStatus>> = {
  leader: {
    DRIVING: "driving",
    ON_DUTY: "on_duty",
    OFF_DUTY: "off_duty",
    SLEEPER: "sleeper_berth",
  },
  factor: {
    D: "driving",
    ON: "on_duty",
    OFF: "off_duty",
    SB: "sleeper_berth",
  },
  nexus: {
    driving: "driving",
    on_duty: "on_duty",
    off_duty: "off_duty",
    sleeper_berth: "sleeper_berth",
  },
};

const VIOLATION_TYPE_MAPS: Record<Provider, Record<string, NormalizedViolationType>> = {
  leader: {
    DRIVE_TIME_EXCEEDED: "drive_time",
    DUTY_TIME_EXCEEDED: "duty_time",
    BREAK_REQUIRED: "break_required",
    CYCLE_LIMIT_EXCEEDED: "cycle_limit",
    UNIDENTIFIED_DRIVING: "unidentified_driving",
  },
  factor: {
    "11H": "drive_time",
    "14H": "duty_time",
    "30MIN": "break_required",
    "70H": "cycle_limit",
  },
  nexus: {
    "hos.drive_time": "drive_time",
    "hos.duty_time": "duty_time",
    "hos.break_required": "break_required",
    "hos.cycle_limit": "cycle_limit",
    "hos.unidentified_driving": "unidentified_driving",
  },
};

export function normalizeDutyStatus(provider: Provider, rawStatus: string): NormalizedDutyStatus {
  return DUTY_STATUS_MAPS[provider][rawStatus] ?? "off_duty";
}

export function normalizeViolationType(provider: Provider, rawType: string): NormalizedViolationType {
  return VIOLATION_TYPE_MAPS[provider][rawType] ?? "other";
}
