/**
 * Today vs Baseline morning card.
 *
 * Shows today's resting heart rate, HRV, wrist temperature deviation,
 * and respiratory rate alongside a 28-day rolling median + IQR fence
 * computed from oura_daily. Days outside the fence get a blush accent
 * with plain-language copy.
 *
 * Non-diagnostic by design: copy says "higher than your usual range
 * today", never "your RHR is elevated". The card is a read-only
 * observation, not advice.
 *
 * This is a server component. It takes pre-fetched rows so the home
 * page can keep its single parallel fetch batch and not add another
 * round trip. The computation is pure and covered in
 * src/lib/intelligence/__tests__/baseline.test.ts.
 */

import {
  computeAllBaselines,
  copyForResult,
  formatRange,
  formatValue,
  METRIC_COPY,
  type BaselineMetricId,
  type BaselineResult,
  type DailyRow,
} from '@/lib/intelligence/baseline';
import { InfoTip } from '@/components/ui/InfoTip';

const METRIC_TIP_TERM: Partial<Record<BaselineMetricId, string>> = {
  rhr: 'rhr',
  hrv: 'hrv',
  resp_rate: 'respiratory rate',
  body_temp: 'body temp',
};

interface Props {
  /**
   * The 28 most recent oura_daily rows BEFORE today (ascending or
   * descending, we only read individual fields). Today's row is passed
   * separately via `todayRow` so we never include it in the baseline.
   */
  windowRows: DailyRow[];
  /** Today's oura_daily row if it exists, else null. */
  todayRow: DailyRow | null;
  /**
   * Date string (YYYY-MM-DD) of the most recent non-today row. Used to
   * tell the user when data is stale (Oura sync lag is common).
   */
  lastSyncedDate: string | null;
  /** Today's date (YYYY-MM-DD) for the stale-data check. */
  today: string;
}

function flagAccent(result: BaselineResult): string | null {
  if (result.flag === 'higher' || result.flag === 'lower') {
    return 'var(--accent-blush)';
  }
  return null;
}

function MetricRow({ result }: { result: BaselineResult }) {
  const accent = flagAccent(result);
  const copy = METRIC_COPY[result.metric];
  const isOutside = accent !== null;
  const isInsufficient = result.flag === 'insufficient';
  const noToday = result.flag === 'no_today';

  const rangeLabel =
    result.lowerFence !== null && result.upperFence !== null
      ? formatRange(result.metric, result.lowerFence, result.upperFence)
      : null;
  const todayLabel = formatValue(result.metric, result.today);

  const subCopy = (() => {
    if (noToday) return 'No reading synced yet for today.';
    if (isInsufficient) return 'Not enough history yet to set a baseline.';
    return copyForResult(result);
  })();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '10px 12px',
        borderRadius: 10,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        borderLeftWidth: 3,
        borderLeftStyle: 'solid',
        borderLeftColor: accent ?? 'var(--border-light)',
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-primary)',
            lineHeight: 1.3,
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          {copy.label}
          {METRIC_TIP_TERM[result.metric] && (
            <InfoTip term={METRIC_TIP_TERM[result.metric]!} />
          )}
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: 'var(--text-muted)',
            marginTop: 2,
            lineHeight: 1.3,
          }}
        >
          {subCopy ||
            (rangeLabel
              ? `Usual range: ${rangeLabel} ${copy.unit}`
              : 'Baseline unavailable')}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div
          className="tabular"
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: 'var(--text-primary)',
            lineHeight: 1,
          }}
        >
          {todayLabel}
          <span
            style={{
              fontSize: 10,
              fontWeight: 500,
              color: isOutside ? 'var(--accent-blush)' : 'var(--text-muted)',
              marginLeft: 4,
            }}
          >
            {copy.unit}
          </span>
        </div>
        {rangeLabel && (
          <div
            className="tabular"
            style={{
              fontSize: 10.5,
              color: 'var(--text-muted)',
              marginTop: 3,
              lineHeight: 1,
            }}
          >
            typical {rangeLabel}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Stale-reading caption shown above the rows when Oura has not synced
 * today. We never try to hide the gap; transparency is better than a
 * silent old number.
 */
function StaleCaption({
  today,
  lastSyncedDate,
  hasToday,
}: {
  today: string;
  lastSyncedDate: string | null;
  hasToday: boolean;
}) {
  if (hasToday) return null;
  if (!lastSyncedDate) {
    return (
      <p
        style={{
          fontSize: 11.5,
          color: 'var(--text-muted)',
          margin: '4px 0 0 0',
          lineHeight: 1.3,
        }}
      >
        Oura has not synced recent readings yet.
      </p>
    );
  }
  const d1 = new Date(today + 'T00:00:00');
  const d2 = new Date(lastSyncedDate + 'T00:00:00');
  const diff = Math.max(0, Math.round((d1.getTime() - d2.getTime()) / 86400000));
  const phrase =
    diff === 0
      ? 'Awaiting today\u2019s sync.'
      : diff === 1
      ? 'Based on yesterday\u2019s reading.'
      : `Based on your reading ${diff} days ago.`;
  return (
    <p
      style={{
        fontSize: 11.5,
        color: 'var(--text-muted)',
        margin: '4px 0 0 0',
        lineHeight: 1.3,
      }}
    >
      {phrase}
    </p>
  );
}

export function BaselineCard({
  windowRows,
  todayRow,
  lastSyncedDate,
  today,
}: Props) {
  const results = computeAllBaselines(windowRows, todayRow);
  const hasToday = todayRow !== null;

  // If every metric is insufficient or has no today value, don't render
  // the whole card to keep the home page uncluttered for brand-new users.
  // Lanae has 1,187 days so this branch is academic for the main user.
  const anyActive = results.some(
    (r) => r.flag === 'higher' || r.flag === 'lower' || r.flag === 'normal',
  );
  const anyFlagged = results.some(
    (r) => r.flag === 'higher' || r.flag === 'lower',
  );

  // Order: flagged rows first so the blush accent leads, then normal.
  const orderedResults: BaselineResult[] = [
    ...results.filter((r) => r.flag === 'higher' || r.flag === 'lower'),
    ...results.filter((r) => r.flag === 'normal'),
    ...results.filter((r) => r.flag === 'no_today' || r.flag === 'insufficient'),
  ];

  return (
    <div style={{ padding: '0 16px' }}>
      <section
        aria-labelledby="baseline-title"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: '14px 16px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h2
              id="baseline-title"
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0,
                lineHeight: 1.3,
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              Today vs your baseline
              <InfoTip term="baseline" />
            </h2>
            <p
              style={{
                fontSize: 11.5,
                color: 'var(--text-muted)',
                margin: '2px 0 0 0',
                lineHeight: 1.3,
              }}
            >
              {anyFlagged
                ? 'A couple of readings are outside your usual 28 day range.'
                : anyActive
                ? 'Your readings are sitting inside your usual 28 day range.'
                : 'Baseline will appear once more Oura days land.'}
            </p>
          </div>
          {anyFlagged && (
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 600,
                background: 'var(--accent-blush-muted)',
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
              }}
            >
              Heads up
            </span>
          )}
        </div>

        <StaleCaption today={today} lastSyncedDate={lastSyncedDate} hasToday={hasToday} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {orderedResults.map((r) => (
            <MetricRow key={r.metric} result={r} />
          ))}
        </div>

        <p
          style={{
            fontSize: 10.5,
            color: 'var(--text-muted)',
            margin: '4px 0 0 0',
            lineHeight: 1.4,
          }}
        >
          Observation only, not medical advice. Your usual range is a 28 day median with an IQR fence from your Oura readings.
        </p>
      </section>
    </div>
  );
}

// Re-export metric IDs so home page can narrow types without a second
// import path.
export type { BaselineMetricId };
