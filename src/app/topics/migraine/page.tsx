/**
 * Migraine / Headache Topic Page
 *
 * Second anchor in the /topics/* family. Mirrors the orthostatic page
 * structure. Pulls from the `headache_attacks` table (migration 014)
 * and exposes the ICHD-3 chronic migraine threshold (15+ headache
 * days per month for 3+ months) as a visible progress marker.
 *
 * Also surfaces cycle-phase correlation when the denormalized
 * cycle_phase column has coverage. See docs/competitive/headache-diary/
 * for the full feature spec.
 */

import { createServiceClient } from '@/lib/supabase';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

interface HeadacheRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  severity: number | null;
  head_zones: unknown;
  aura_categories: unknown;
  triggers: unknown;
  medications_taken: unknown;
  medication_relief_minutes: number | null;
  notes: string | null;
  cycle_phase: string | null;
  hit6_score: number | null;
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(Math.round((b.getTime() - a.getTime()) / 86400000));
}

function uniqueHeadacheDays(rows: HeadacheRow[]): Set<string> {
  const days = new Set<string>();
  for (const r of rows) {
    const d = new Date(r.started_at);
    if (Number.isNaN(d.getTime())) continue;
    days.add(format(d, 'yyyy-MM-dd'));
  }
  return days;
}

function severityLabel(sev: number | null): {
  label: string;
  color: string;
} {
  if (sev === null) return { label: 'not rated', color: 'var(--text-muted)' };
  if (sev >= 8) return { label: 'severe', color: 'var(--accent-blush)' };
  if (sev >= 5) return { label: 'moderate', color: 'var(--text-primary)' };
  return { label: 'mild', color: 'var(--accent-sage)' };
}

export default async function MigraineTopic() {
  const supabase = createServiceClient();
  const now = new Date();
  const today = format(now, 'yyyy-MM-dd');
  const sixtyAgoISO = format(
    new Date(now.getTime() - 60 * 86400000),
    'yyyy-MM-dd',
  );

  const { data: rows } = await supabase
    .from('headache_attacks')
    .select(
      'id, started_at, ended_at, severity, head_zones, aura_categories, triggers, medications_taken, medication_relief_minutes, notes, cycle_phase, hit6_score',
    )
    .gte('started_at', sixtyAgoISO)
    .order('started_at', { ascending: false });

  const attacks = (((rows ?? []) as unknown) as HeadacheRow[]);
  const latest = attacks[0] ?? null;

  // Last 30 days headache-day count.
  const thirtyAgo = new Date(now.getTime() - 30 * 86400000);
  const last30 = attacks.filter(
    (a) => new Date(a.started_at).getTime() >= thirtyAgo.getTime(),
  );
  const headacheDays30 = uniqueHeadacheDays(last30).size;

  // Chronic migraine threshold = 15+ days/month, so render a progress bar
  // to 15 (not 30) so the meaningful edge is visible.
  const chronicThreshold = 15;
  const chronicRatio = Math.min(1, headacheDays30 / chronicThreshold);
  const atOrAboveChronic = headacheDays30 >= chronicThreshold;

  // Menstrual correlation: fraction of attacks tagged with a luteal or
  // menstrual phase in the last 60 days.
  const cycleTagged = attacks.filter((a) => a.cycle_phase !== null);
  const lutealOrMenstrual = cycleTagged.filter(
    (a) =>
      a.cycle_phase === 'luteal' || a.cycle_phase === 'menstrual',
  );
  const cycleCoverageRatio =
    cycleTagged.length > 0
      ? lutealOrMenstrual.length / cycleTagged.length
      : null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        padding: '16px',
        maxWidth: 720,
        margin: '0 auto',
        paddingBottom: 96,
      }}
    >
      {/* Breadcrumb */}
      <a
        href="/"
        style={{
          fontSize: 13,
          color: 'var(--text-muted)',
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
          <path
            d="M12.5 5L7.5 10L12.5 15"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Home
      </a>

      {/* Hero */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Topic
        </span>
        <h1 style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.15, margin: 0 }}>
          Migraine &amp; headache
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--text-secondary)', margin: 0 }}>
          Tracking attack frequency, severity, zones, aura, and triggers. The
          ICHD-3 chronic migraine definition is 15 or more headache days per
          month for at least 3 months. This page shows where your last 30 days
          sit against that threshold.
        </p>
      </div>

      {/* Chronic threshold progress */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: '16px 18px',
          borderRadius: 16,
          background: 'linear-gradient(180deg, #FFFFFF 0%, #FDFDFB 100%)',
          border: '1px solid var(--border-light)',
          borderLeftWidth: 3,
          borderLeftStyle: 'solid',
          borderLeftColor: atOrAboveChronic
            ? 'var(--accent-blush)'
            : 'var(--accent-sage)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            30-day headache days
          </span>
          <span className="tabular" style={{ fontSize: 22, fontWeight: 700 }}>
            {headacheDays30} / {chronicThreshold}
          </span>
        </div>
        <div
          style={{
            position: 'relative',
            height: 8,
            borderRadius: 4,
            background: 'var(--border-light)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              width: `${Math.round(chronicRatio * 100)}%`,
              background: atOrAboveChronic
                ? 'var(--accent-blush)'
                : 'var(--accent-sage)',
            }}
          />
        </div>
        <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0 }}>
          {atOrAboveChronic
            ? 'At or above the chronic migraine threshold this month. Worth bringing to your neurologist with the 3-month pattern.'
            : `Below the chronic migraine threshold (15 days/month). ${
                headacheDays30 > 0
                  ? `${chronicThreshold - headacheDays30} more headache days would cross the line.`
                  : 'No headache days logged in this window.'
              }`}
        </p>
      </div>

      {/* Latest attack */}
      {latest && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: '14px 16px',
            borderRadius: 14,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Latest attack
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {daysBetween(now, new Date(latest.started_at)) === 0
                ? 'Today'
                : `${daysBetween(now, new Date(latest.started_at))} days ago`}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span
              className="tabular"
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: severityLabel(latest.severity).color,
              }}
            >
              {latest.severity ?? '\u2014'}
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              severity ({severityLabel(latest.severity).label})
            </span>
          </div>
          {latest.cycle_phase && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Cycle phase at onset: <strong>{latest.cycle_phase}</strong>
            </div>
          )}
          {latest.medication_relief_minutes !== null && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Medication relief in <strong>{latest.medication_relief_minutes} min</strong>
            </div>
          )}
        </div>
      )}

      {/* Cycle correlation card */}
      {cycleCoverageRatio !== null && cycleTagged.length >= 3 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: '14px 16px',
            borderRadius: 14,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Cycle correlation
          </span>
          <div style={{ fontSize: 14, lineHeight: 1.5 }}>
            <strong className="tabular">{Math.round(cycleCoverageRatio * 100)}%</strong>{' '}
            of tagged attacks landed in luteal or menstrual phase (n={cycleTagged.length}).
            {cycleCoverageRatio >= 0.6
              ? ' Strong menstrual-migraine signal in this window.'
              : cycleCoverageRatio >= 0.4
                ? ' Moderate menstrual pattern.'
                : ' No strong phase pattern.'}
          </div>
        </div>
      )}

      {/* Explainer */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: '14px 16px',
          borderRadius: 14,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          What the numbers mean
        </span>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            fontSize: 13,
            lineHeight: 1.55,
          }}
        >
          <p style={{ margin: 0 }}>
            <strong>Headache days</strong> counts unique calendar days with at
            least one logged attack. Multiple attacks the same day count once.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Chronic migraine (ICHD-3)</strong> = 15+ headache days per
            month, of which 8+ have migraine features, for at least 3 months.
            Hitting 15 in one month is not a diagnosis on its own.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Menstrual-migraine pattern</strong> = attacks clustered in
            luteal and early menstrual phases. A 60%+ correlation is clinically
            meaningful and can change treatment options.
          </p>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            Triggers captured in the log (sleep loss, barometric drops, specific
            foods) are analyzed in the Patterns page for correlation.
          </p>
        </div>
      </div>

      {/* CTA */}
      <a
        href="/log"
        className="press-feedback"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          borderRadius: 14,
          background: 'linear-gradient(135deg, #7CA391 0%, #6B9080 50%, #5D7E6F 100%)',
          color: 'var(--text-inverse)',
          textDecoration: 'none',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 600 }}>Log a new attack</span>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
          <path
            d="M7.5 5L12.5 10L7.5 15"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </a>
    </div>
  );
}
