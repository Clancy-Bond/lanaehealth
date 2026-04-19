/**
 * Body-temperature deviation gauge.
 *
 * The single best-reviewed Oura feature for chronic-illness users is the
 * temperature-deviation trend; it catches illness and cycle phases
 * before the user feels either (docs/competitive/oura/user-reviews.md).
 * We mirror the pattern: show today's deviation as a horizontal gauge
 * with the Oura +/- 0.5 C "heads up" zone marked, plus the 7-day
 * trajectory so Lanae can see direction at a glance.
 *
 * Deviation is already stored relative to her personal 90-day baseline,
 * so absolute temperature never enters the UI -- voice-rule compliant.
 */

interface BodyTempGaugeProps {
  todayDeviation: number | null;
  trendDeviations: (number | null)[];
}

const MIN = -1.0;
const MAX = 1.0;

function clamp(value: number): number {
  return Math.max(MIN, Math.min(MAX, value));
}

function positionPct(deviation: number): number {
  const clamped = clamp(deviation);
  return ((clamped - MIN) / (MAX - MIN)) * 100;
}

export function BodyTempGauge({ todayDeviation, trendDeviations }: BodyTempGaugeProps) {
  const hasToday = todayDeviation !== null && Number.isFinite(todayDeviation);
  const outsideBand = hasToday && Math.abs(todayDeviation ?? 0) >= 0.5;
  const validTrend = trendDeviations.filter(
    (d): d is number => d !== null && Number.isFinite(d),
  );
  const trendDirection = (() => {
    if (validTrend.length < 2) return null;
    const [first] = validTrend;
    const last = validTrend[validTrend.length - 1];
    if (Math.abs(last - first) < 0.05) return 'stable' as const;
    return last > first ? 'rising' : ('falling' as const);
  })();

  const todayPct = hasToday ? positionPct(todayDeviation!) : null;

  return (
    <section
      aria-labelledby="body-temp-title"
      style={{
        padding: '14px 16px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h3
          id="body-temp-title"
          style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}
        >
          Body temperature
        </h3>
        <span
          className="tabular"
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: outsideBand ? 'var(--accent-blush)' : 'var(--text-primary)',
          }}
        >
          {hasToday
            ? `${todayDeviation! > 0 ? '+' : ''}${todayDeviation!.toFixed(2)} \u00B0C`
            : '\u2014'}
        </span>
      </div>

      <div
        aria-hidden
        style={{
          position: 'relative',
          height: 16,
          borderRadius: 'var(--radius-full)',
          background: 'linear-gradient(90deg, var(--accent-blush-muted) 0%, var(--bg-elevated) 30%, var(--accent-sage-muted) 50%, var(--bg-elevated) 70%, var(--accent-blush-muted) 100%)',
          overflow: 'hidden',
        }}
      >
        {/* Dotted mid-line at 0 deviation */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: '50%',
            width: 0,
            borderLeft: '1px dashed var(--text-muted)',
            opacity: 0.55,
          }}
        />
        {/* Today's marker */}
        {todayPct !== null && (
          <div
            style={{
              position: 'absolute',
              top: -3,
              bottom: -3,
              left: `calc(${todayPct}% - 5px)`,
              width: 10,
              borderRadius: 'var(--radius-full)',
              background: outsideBand ? 'var(--accent-blush)' : 'var(--accent-sage)',
              border: '2px solid #fff',
              boxShadow: 'var(--shadow-sm)',
            }}
          />
        )}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10,
          color: 'var(--text-muted)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          fontWeight: 600,
        }}
      >
        <span>-1 \u00B0C</span>
        <span>Baseline</span>
        <span>+1 \u00B0C</span>
      </div>

      <p
        style={{
          fontSize: 11.5,
          color: 'var(--text-muted)',
          margin: 0,
          lineHeight: 1.4,
        }}
      >
        {!hasToday
          ? 'No reading yet for today.'
          : outsideBand
          ? 'Outside your usual \u00B10.5 \u00B0C band. Cycle phase or illness can both drive this.'
          : 'Sitting inside your usual \u00B10.5 \u00B0C band.'}
        {trendDirection && validTrend.length >= 3 && (
          <>
            {' '}
            7-day trend is {trendDirection}.
          </>
        )}
      </p>
    </section>
  );
}
