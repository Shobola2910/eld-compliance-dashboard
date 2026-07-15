// Standard US FMCSA Hours-of-Service rules for property-carrying drivers:
// - 11-hour driving limit within a 14-hour on-duty window, following 10 consecutive hours off
// - 30-minute break required after 8 cumulative hours of driving (any 30+ min non-driving break qualifies)
// - 70-hour / 8-day cycle limit, reset by 34+ consecutive hours off duty
//
// Known simplifications (not implemented): the sleeper-berth split-duty provision (e.g. 7/3 or
// 8/2 splits), adverse driving conditions extensions, short-haul exemptions. Cycle accuracy also
// depends on how much log history is actually available -- a newly connected driver with less
// than 8 days of synced logs will show more cycle time remaining than may actually be true.

export type DutyStatus = "driving" | "on_duty" | "off_duty" | "sleeper_berth";

export interface DutySegment {
  dutyStatus: DutyStatus;
  startedAt: Date;
  endedAt: Date;
}

export interface HosStatus {
  currentDutyStatus: DutyStatus | "unknown";
  breakRemainingMs: number;
  driveRemainingMs: number;
  shiftRemainingMs: number;
  cycleRemainingMs: number;
}

const HOUR_MS = 60 * 60 * 1000;
const ELEVEN_HOURS_MS = 11 * HOUR_MS;
const FOURTEEN_HOURS_MS = 14 * HOUR_MS;
const EIGHT_HOURS_MS = 8 * HOUR_MS;
const THIRTY_MIN_MS = 30 * 60 * 1000;
const SEVENTY_HOURS_MS = 70 * HOUR_MS;
const THIRTY_FOUR_HOURS_MS = 34 * HOUR_MS;
const TEN_HOURS_MS = 10 * HOUR_MS;
export const CYCLE_LOOKBACK_MS = 8 * 24 * HOUR_MS;

const REST_STATUSES: DutyStatus[] = ["off_duty", "sleeper_berth"];

export function computeHosStatus(segments: DutySegment[], now: Date): HosStatus {
  const sorted = [...segments].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());

  if (sorted.length === 0) {
    return {
      currentDutyStatus: "unknown",
      breakRemainingMs: EIGHT_HOURS_MS,
      driveRemainingMs: ELEVEN_HOURS_MS,
      shiftRemainingMs: FOURTEEN_HOURS_MS,
      cycleRemainingMs: SEVENTY_HOURS_MS,
    };
  }

  const currentDutyStatus = sorted[sorted.length - 1].dutyStatus;

  // 1) Find the start of the current duty window -- the most recent >=10h continuous
  // off-duty/sleeper block. The 14h and 11h clocks both reset from that point.
  let windowStart = sorted[0].startedAt;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const seg = sorted[i];
    if (REST_STATUSES.includes(seg.dutyStatus)) {
      const duration = seg.endedAt.getTime() - seg.startedAt.getTime();
      if (duration >= TEN_HOURS_MS) {
        windowStart = seg.endedAt;
        break;
      }
    }
  }

  // 2) 14-hour shift window remaining
  const shiftRemainingMs = Math.max(0, FOURTEEN_HOURS_MS - (now.getTime() - windowStart.getTime()));

  // 3) 11-hour drive limit remaining (driving time within the current window only)
  let drivingMsInWindow = 0;
  for (const seg of sorted) {
    if (seg.dutyStatus === "driving" && seg.endedAt.getTime() > windowStart.getTime()) {
      const start = Math.max(seg.startedAt.getTime(), windowStart.getTime());
      const end = Math.min(seg.endedAt.getTime(), now.getTime());
      if (end > start) drivingMsInWindow += end - start;
    }
  }
  const driveRemainingMs = Math.max(0, ELEVEN_HOURS_MS - drivingMsInWindow);

  // 4) 30-minute break: cumulative driving since the last qualifying (30+ min) non-driving break
  let drivingSinceBreak = 0;
  for (const seg of sorted) {
    if (seg.endedAt.getTime() <= windowStart.getTime()) continue;
    const start = Math.max(seg.startedAt.getTime(), windowStart.getTime());
    const end = Math.min(seg.endedAt.getTime(), now.getTime());
    if (end <= start) continue;
    const duration = end - start;
    if (seg.dutyStatus === "driving") {
      drivingSinceBreak += duration;
    } else if (duration >= THIRTY_MIN_MS) {
      drivingSinceBreak = 0;
    }
  }
  const breakRemainingMs = Math.max(0, EIGHT_HOURS_MS - drivingSinceBreak);

  // 5) 70-hour/8-day cycle, restarting after any 34+ consecutive hour break within the lookback
  const cycleLookbackStart = new Date(now.getTime() - CYCLE_LOOKBACK_MS);
  let restartPoint = cycleLookbackStart;
  for (const seg of sorted) {
    if (REST_STATUSES.includes(seg.dutyStatus) && seg.startedAt.getTime() >= cycleLookbackStart.getTime()) {
      const duration = seg.endedAt.getTime() - seg.startedAt.getTime();
      if (duration >= THIRTY_FOUR_HOURS_MS && seg.endedAt.getTime() > restartPoint.getTime()) {
        restartPoint = seg.endedAt;
      }
    }
  }
  let onDutyMsInCycle = 0;
  for (const seg of sorted) {
    if (
      (seg.dutyStatus === "driving" || seg.dutyStatus === "on_duty") &&
      seg.endedAt.getTime() > restartPoint.getTime()
    ) {
      const start = Math.max(seg.startedAt.getTime(), restartPoint.getTime());
      const end = Math.min(seg.endedAt.getTime(), now.getTime());
      if (end > start) onDutyMsInCycle += end - start;
    }
  }
  const cycleRemainingMs = Math.max(0, SEVENTY_HOURS_MS - onDutyMsInCycle);

  return { currentDutyStatus, breakRemainingMs, driveRemainingMs, shiftRemainingMs, cycleRemainingMs };
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function formatRelativeTime(date: Date, now: Date): string {
  const diffMs = now.getTime() - date.getTime();
  const minutes = Math.floor(diffMs / (60 * 1000));
  if (minutes < 1) return "0m ago";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
