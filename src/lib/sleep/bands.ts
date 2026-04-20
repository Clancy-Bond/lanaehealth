/**
 * Score-to-band mapping for the Sleep tab.
 *
 * Oura users consistently praise the "Pay attention / Good / Optimal"
 * framing over a raw 0-100 number (docs/competitive/oura/user-reviews.md).
 * We reuse the same label set so Lanae reads the same vocabulary she
 * already knows from Oura, while the UI keeps non-shaming accents
 * (blush for "Pay attention", sage for "Good" and above).
 *
 * The thresholds match Oura's public docs: <60 pay attention, 60-69 fair,
 * 70-84 good, 85-100 optimal. Kept in one place so every sleep component
 * agrees on the same break-points.
 */

export type ScoreBand = 'pay-attention' | 'fair' | 'good' | 'optimal' | 'unknown';

export interface BandMeta {
  band: ScoreBand;
  label: string;
  color: string;
}

/**
 * Map a 0-100 score (or null) to its band label + token color.
 * Unknown scores get the muted text color; we never imply a value where
 * none exists.
 */
export function bandForScore(score: number | null | undefined): BandMeta {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return { band: 'unknown', label: 'No reading', color: 'var(--text-muted)' };
  }
  if (score >= 85) return { band: 'optimal', label: 'Optimal', color: 'var(--accent-sage)' };
  if (score >= 70) return { band: 'good', label: 'Good', color: 'var(--accent-sage)' };
  if (score >= 60) return { band: 'fair', label: 'Fair', color: 'var(--phase-luteal)' };
  return { band: 'pay-attention', label: 'Pay attention', color: 'var(--accent-blush)' };
}

/**
 * Format seconds into "7h 12m". Nulls or zero-ish inputs return null so
 * the caller can substitute its own empty state.
 */
export function formatDurationFromSeconds(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  const totalMin = Math.round(seconds / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Return the sleep-score's delta vs. the 7-day average, rounded. Returns
 * null when either input is missing so the UI can show a neutral dash.
 */
export function deltaVsAverage(today: number | null, avg: number | null): number | null {
  if (today === null || avg === null || !Number.isFinite(today) || !Number.isFinite(avg)) {
    return null;
  }
  return Math.round(today - avg);
}
