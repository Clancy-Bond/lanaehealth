/**
 * Morning Signal Card
 *
 * LanaeHealth's answer to Oura's Readiness card. Surfaces one number
 * (0-100) plus the 4 biggest contributors so Lanae can see at a glance
 * whether her body is asking for a lighter day, and why.
 *
 * The formula in readiness-signal.ts::computeReadiness is a placeholder.
 * Clancy owns the final weighted version (Learning-Mode decision).
 * Until that lands, the card falls back to Oura's own readiness_score.
 *
 * Copy rules (non-diagnostic, sage+blush palette):
 *   - Never say "low readiness". Say "body asking for a lighter day."
 *   - Never prescribe rest. Suggest "pace yourself" or "save the heavy stuff".
 *   - Arrows are directional only. Up HRV = sage. Up RHR = blush. etc.
 *
 * Server component. No state. Data comes pre-fetched from page.tsx.
 */

import {
  buildReadinessSignal,
  type OuraRow,
  type ReadinessSignal,
  type Contributor,
} from '@/lib/intelligence/readiness-signal';

interface Props {
  /** Today's oura_daily row, or null if no sync yet. */
  today: OuraRow | null;
  /** Up to 7 prior oura_daily rows, most recent first. */
  trend: OuraRow[];
  /** Today's date YYYY-MM-DD, so we can flag a stale-read. */
  todayDate: string;
}

function bandLabel(score: number | null): {
  label: string;
  color: string;
  accent: string;
} {
  if (score === null) {
    return {
      label: 'No signal yet',
      color: 'var(--text-muted)',
      accent: 'var(--border-light)',
    };
  }
  if (score >= 80) {
    return {
      label: 'Body ready for a normal day',
      color: 'var(--accent-sage)',
      accent: 'var(--accent-sage)',
    };
  }
  if (score >= 65) {
    return {
      label: 'Room to move, pace yourself',
      color: 'var(--accent-sage)',
      accent: 'var(--accent-sage-muted)',
    };
  }
  if (score >= 50) {
    return {
      label: 'Body asking for a lighter day',
      color: 'var(--text-primary)',
      accent: 'var(--accent-blush-light)',
    };
  }
  return {
    label: 'Save the heavy stuff',
    color: 'var(--accent-blush)',
    accent: 'var(--accent-blush)',
  };
}

/**
 * Direction arrow for a single contributor. Sage when the direction
 * is favorable, blush when unfavorable, muted when flat or missing.
 */
function arrowFor(c: Contributor): { glyph: string; color: string } {
  if (c.direction === 'missing' || c.direction === 'flat') {
    return { glyph: '\u2192', color: 'var(--text-muted)' };
  }
  const favorable =
    (c.direction === 'up' && c.favorableDirection === 'up') ||
    (c.direction === 'down' && c.favorableDirection === 'down');
  const glyph = c.direction === 'up' ? '\u2191' : '\u2193';
  const color = favorable ? 'var(--accent-sage)' : 'var(--accent-blush)';
  return { glyph, color };
}

function stalePhrase(readingDate: string | null, today: string): string | null {
  if (!readingDate) return null;
  if (readingDate === today) return null;
  const d = new Date(readingDate + 'T00:00:00');
  const t = new Date(today + 'T00:00:00');
  const diffDays = Math.round((t.getTime() - d.getTime()) / 86400000);
  if (diffDays === 1) return 'Based on yesterday\u2019s reading';
  if (diffDays > 1) return `Based on a reading ${diffDays} days ago`;
  return null;
}

export function MorningSignalCard({ today, trend, todayDate }: Props) {
  const signal: ReadinessSignal = buildReadinessSignal({ today, trend });
  const band = bandLabel(signal.score);
  const stale = stalePhrase(today?.date ?? null, todayDate);

  // If we truly have nothing to render, show a friendly empty state.
  if (signal.score === null && signal.topContributors.every((c) => c.direction === 'missing')) {
    return (
      <div style={{ padding: '0 16px' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            padding: '14px 16px',
            borderRadius: 14,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Morning signal
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Waiting on a fresh Oura sync. Open the ring app to pull last night.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 16px' }}>
      <a
        href="/intelligence/readiness"
        className="press-feedback"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: '16px 18px',
          borderRadius: 16,
          background: 'linear-gradient(180deg, #FFFFFF 0%, #FDFDFB 100%)',
          border: '1px solid var(--border-light)',
          borderLeftWidth: 3,
          borderLeftStyle: 'solid',
          borderLeftColor: band.accent,
          boxShadow: 'var(--shadow-sm)',
          textDecoration: 'none',
          color: 'var(--text-primary)',
          transition:
            'transform var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard)',
        }}
      >
        {/* Header row: label + chevron */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Morning signal
          </span>
          <svg
            width="18"
            height="18"
            viewBox="0 0 20 20"
            fill="none"
            style={{ color: 'var(--text-muted)' }}
          >
            <path
              d="M7.5 5L12.5 10L7.5 15"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Score + band label */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span
            className="tabular"
            style={{
              fontSize: 42,
              fontWeight: 700,
              lineHeight: 1,
              color: band.color,
            }}
          >
            {signal.score ?? '\u2014'}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 14, lineHeight: 1.25, fontWeight: 600 }}>
              {band.label}
            </span>
            {signal.source === 'oura' && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Showing Oura&rsquo;s score. Your own formula is coming.
              </span>
            )}
            {stale && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{stale}</span>
            )}
          </div>
        </div>

        {/* Contributors grid (4 max) */}
        {signal.topContributors.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: 8,
              marginTop: 2,
            }}
          >
            {signal.topContributors.slice(0, 4).map((c) => {
              const arrow = arrowFor(c);
              return (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    padding: '8px 10px',
                    borderRadius: 10,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-light)',
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                    }}
                  >
                    {c.label}
                  </span>
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 4,
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    <span className="tabular">{c.valueLabel}</span>
                    <span style={{ color: arrow.color, fontSize: 14, lineHeight: 1 }}>
                      {arrow.glyph}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Narrative footer */}
        {signal.narrative && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              lineHeight: 1.4,
            }}
          >
            {signal.narrative}
          </div>
        )}
      </a>
    </div>
  );
}
