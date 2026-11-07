const REVIEW_TTL_MS = 5 * 60_000;
const REVIEW_TTL_NS = BigInt(REVIEW_TTL_MS) * 1_000_000n;

/** Vigencia de proceso; no usar estos relojes como metadata persistente. */
export function createRecoveryReviewLifetime(): { consume: () => boolean; expired: () => boolean } {
  const monotonicDeadline = process.hrtime.bigint() + REVIEW_TTL_NS;
  const wallDeadline = Date.now() + REVIEW_TTL_MS;
  let consumed = false;
  let hasExpired = false;
  const expired = () => {
    // Retroceder hora civil no amplía el plazo; adelantarla falla restrictivamente.
    hasExpired ||= Date.now() >= wallDeadline || process.hrtime.bigint() >= monotonicDeadline;
    return hasExpired;
  };
  return { expired, consume: () => {
    if (consumed) return false;
    consumed = true;
    return !expired();
  } };
}
