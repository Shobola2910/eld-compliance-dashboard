export const STALE_PROFILE_THRESHOLD_DAYS = 3;

export function isProfileStale(shippingDocsUpdatedAt: Date | null, now: Date): boolean {
  if (!shippingDocsUpdatedAt) return true;
  const ageMs = now.getTime() - shippingDocsUpdatedAt.getTime();
  return ageMs > STALE_PROFILE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
}
