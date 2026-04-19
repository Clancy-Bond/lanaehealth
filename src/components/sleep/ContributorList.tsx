/**
 * Readiness contributor list (waterfall-style).
 *
 * Oura's opacity is its #2 user complaint ("readiness 87 but HRV is my
 * lowest in weeks, feels inconsistent"). We spell out the drivers:
 * each row shows today's value, the 28-day baseline, the direction of
 * change, and whether it nudged readiness up or down. Voice rules apply
 * -- "lower than your usual range" not "your HRV is bad".
 */

import { computeContributors, type ContributorRow } from '@/lib/sleep/contributors';

interface Props {
  windowRows: ContributorRow[];
  todayRow: ContributorRow | null;
}

function formatValue(key: string, value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '\u2014';
  if (key === 'body_temp') return `${value > 0 ? '+' : ''}${value.toFixed(2)} \u00B0C`;
  if (key === 'respiratory_rate') return value.toFixed(1);
  return Math.round(value).toString();
}

const UNITS: Record<string, string> = {
  hrv: 'ms',
  resting_hr: 'bpm',
  sleep: '/100',
  body_temp: '',
  respiratory_rate: 'br/min',
};

export function ContributorList({ windowRows, todayRow }: Props) {
  const contributors = computeContributors(windowRows, todayRow);

  return (
    <section
      aria-labelledby="contributors-title"
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
      <div>
        <h3
          id="contributors-title"
          style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}
        >
          What moved readiness
        </h3>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0', lineHeight: 1.4 }}>
          Biggest drivers first. Baseline is a 28-day median.
        </p>
      </div>

      <ul
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          listStyle: 'none',
          padding: 0,
          margin: 0,
        }}
      >
        {contributors.map((c) => {
          const accent =
            c.influence === 'negative'
              ? 'var(--accent-blush)'
              : c.influence === 'positive'
              ? 'var(--accent-sage)'
              : 'var(--border-light)';
          const unit = UNITS[c.key] ?? '';
          return (
            <li
              key={c.key}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto auto',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                borderRadius: 10,
                background: 'var(--bg-primary)',
                borderLeft: `3px solid ${accent}`,
              }}
            >
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {c.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {c.influence === 'no_data'
                    ? 'No reading yet.'
                    : c.influence === 'neutral'
                    ? 'Near your 28-day usual'
                    : c.direction === 'up'
                    ? 'Higher than your usual range'
                    : 'Lower than your usual range'}
                </div>
              </div>
              <span
                className="tabular"
                style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}
              >
                {formatValue(c.key, c.today)}
                {unit && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 3 }}>
                    {unit}
                  </span>
                )}
              </span>
              <span
                className="tabular"
                style={{ fontSize: 10, color: 'var(--text-muted)', minWidth: 54, textAlign: 'right' }}
              >
                {c.baseline !== null ? `base ${formatValue(c.key, c.baseline)}` : '\u2014'}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
