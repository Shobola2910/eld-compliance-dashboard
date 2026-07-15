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
    // "DS_D" confirmed real (from /api/v1/hos/system-list's current_status field).
    // The other three follow the same "DS_" prefix pattern but aren't confirmed yet --
    // unmatched codes fall back to "off_duty" via the default below, so a wrong guess
    // here just means a driver shows as off-duty instead of throwing.
    DS_D: "driving",
    DS_ON: "on_duty",
    DS_OFF: "off_duty",
    DS_SB: "sleeper_berth",
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
    // "DRIVING_TIME_EXCEEDED" confirmed real (from the same system-list response's
    // per-driver violations array). The rest are educated guesses following the same
    // naming convention -- unmatched types fall back to "other" below, not an error.
    DRIVING_TIME_EXCEEDED: "drive_time",
    DUTY_TIME_EXCEEDED: "duty_time",
    BREAK_REQUIRED: "break_required",
    CYCLE_LIMIT_EXCEEDED: "cycle_limit",
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
