export interface CertifyEligibilityInput {
  startedAt: Date;
  endedAt: Date | null;
  hasOverlappingOpenViolation: boolean;
}

const MAX_PLAUSIBLE_SEGMENT_HOURS = 24;

// Pure eligibility rule, deliberately separate from the provider API call
// (adapter.certifyLogs) so it can be unit-tested without mocking network I/O.
export function isEligibleForAutoCertify(input: CertifyEligibilityInput): boolean {
  if (!input.endedAt) return false; // segment still open/in-progress
  if (input.hasOverlappingOpenViolation) return false;

  const durationHours = (input.endedAt.getTime() - input.startedAt.getTime()) / (1000 * 60 * 60);
  if (durationHours <= 0 || durationHours > MAX_PLAUSIBLE_SEGMENT_HOURS) return false;

  return true;
}
