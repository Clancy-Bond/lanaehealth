// ARCHIVED: This legacy route is now redirected to /v2/topics/orthostatic via next.config.ts.
// Kept in source for fast revert. To revive: remove the redirect in next.config.ts.
// Cutover landed: 2026-04-25 (legacy → v2 unified merge).

/**
 * Orthostatic / POTS Topic Page
 *
 * First anchor page in the /topics/* family, inspired by Oura's
 * sleep-and-rest / heart-health pages and Bearable's condition-
 * specific landing pages. Combines:
 *   - Lanae's own orthostatic test history (from orthostatic_tests)
 *   - The POTS diagnostic criterion (3 positives >= 14 days apart,
 *     peak rise >= 30 bpm sustained 10 minutes) as progress tracking
 *   - Plain-English explanation of what the numbers mean
 *   - Cycle / caffeine / hydration context where the data carries it
 *
 * Serves two audiences:
 *   - Lanae: quick health-literacy reference + progress toward
 *     formal diagnosis documentation for future specialist visits.
 *   - Future public users (post-launch): SEO-quality explainer
 *     of orthostatic testing.
 *
 * Voice follows the non-shaming rule. No "you should" phrasing.
 * This is a reading page, not a nudge surface.
 */

import { createServiceClient } from '@/lib/supabase';
import { format } from 'date-fns';
import {
  summarize,
  THRESHOLDS,
  type OrthostaticTest,
  type ClassifiedTest,
} from '@/lib/intelligence/orthostatic';
import { TopicCycleBanner } from '@/components/topics/TopicCycleBanner';
import { ResearchCitations } from '@/components/topics/ResearchCitations';

export const dynamic = 'force-dynamic';

export default async function OrthostaticTopic() {
  const supabase = createServiceClient();
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: rows } = await supabase
    .from('orthostatic_tests')
    .select(
      'id, test_date, test_time, resting_hr_bpm, resting_bp_systolic, resting_bp_diastolic, ' +
        'standing_hr_1min, standing_hr_3min, standing_hr_5min, standing_hr_10min, ' +
        'standing_bp_systolic_10min, standing_bp_diastolic_10min, peak_rise_bpm, ' +
        'symptoms_experienced, notes, hydration_ml, caffeine_mg',
    )
    .order('test_date', { ascending: false })
    .limit(60);

  const summary = summarize(((rows ?? []) as unknown) as OrthostaticTest[], today);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
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
          <TopicCycleBanner />
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.15, margin: 0 }}>
          Orthostatic tracking
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--text-secondary)', margin: 0 }}>
          How your heart rate changes from lying down to standing up. When
          that change is consistently large, it can mean POTS (Postural
          Orthostatic Tachycardia Syndrome). Formal diagnosis needs three
          positive tests, at least two weeks apart.
        </p>
      </div>

      {/* Diagnostic progress */}
      <DiagnosticProgressCard
        qualifyingPositives={summary.diagnosticProgress.qualifyingPositives}
        remainingNeeded={summary.diagnosticProgress.remainingNeeded}
        qualifyingDates={summary.diagnosticProgress.qualifyingDates}
        earliestNextQualifyingDate={summary.diagnosticProgress.earliestNextQualifyingDate}
      />

      {/* Latest test */}
      {summary.latest && <LatestTestCard test={summary.latest} today={today} />}

      {/* At-a-glance stats */}
      {summary.tests.length > 0 && (
        <AtAGlanceCard
          median30d={summary.median30dPeakRise}
          positiveLast60Days={summary.positiveLast60Days}
          totalTests={summary.tests.length}
        />
      )}

      {/* 30-day trend */}
      {summary.tests.length >= 2 && <TrendSparkline tests={summary.tests} />}

      {/* What the numbers mean */}
      <ExplainerCard />

      {/* Clinical citations */}
      <ResearchCitations
        citations={[
          {
            label:
              'Resting HRV as a diagnostic marker of cardiovascular dysautonomia in POTS',
            url: 'https://pubmed.ncbi.nlm.nih.gov/36367272/',
            source: 'PubMed 36367272',
          },
          {
            label: 'HRV systematic review in POTS vs healthy controls',
            url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6936126/',
            source: 'PMC6936126',
          },
          {
            label:
              '013_orthostatic_tests.sql: 30 bpm threshold, 10 min duration, 3 positives >=2 weeks apart',
            url: 'https://github.com/Clancy-Bond/lanaehealth/blob/main/src/lib/migrations/013_orthostatic_tests.sql',
            source: 'LanaeHealth migration',
          },
        ]}
      />

      {/* CTA */}
      <a
        href="/topics/orthostatic/new"
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
        <span style={{ fontSize: 15, fontWeight: 600 }}>Log a new test</span>
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

// ────────────────────────────────────────────────────────────────────
// Cards
// ────────────────────────────────────────────────────────────────────

function DiagnosticProgressCard({
  qualifyingPositives,
  remainingNeeded,
  qualifyingDates,
  earliestNextQualifyingDate,
}: {
  qualifyingPositives: number;
  remainingNeeded: number;
  qualifyingDates: string[];
  earliestNextQualifyingDate: string | null;
}) {
  const atThreshold = remainingNeeded === 0;
  const accent = atThreshold ? 'var(--accent-blush)' : 'var(--accent-sage)';

  return (
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
        borderLeftColor: accent,
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
          Diagnostic progress
        </span>
        <span className="tabular" style={{ fontSize: 22, fontWeight: 700 }}>
          {qualifyingPositives} / {THRESHOLDS.REQUIRED_POSITIVES}
        </span>
      </div>
      {atThreshold ? (
        <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0 }}>
          You have {THRESHOLDS.REQUIRED_POSITIVES} positive tests at least{' '}
          {THRESHOLDS.MIN_DAYS_BETWEEN_QUALIFYING_TESTS} days apart. That
          meets the usual threshold clinicians use to document POTS. Bring
          this list to your next specialist visit.
        </p>
      ) : (
        <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0 }}>
          {qualifyingPositives === 0
            ? 'No qualifying positive tests yet. A positive test is a peak heart-rate rise of 30+ bpm sustained for 10 minutes.'
            : `${remainingNeeded} more qualifying positive test${
                remainingNeeded === 1 ? '' : 's'
              } would meet the usual threshold clinicians use.`}
        </p>
      )}
      {qualifyingDates.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Qualifying dates:{' '}
          {qualifyingDates
            .map((d) => format(new Date(d + 'T00:00:00'), 'MMM d'))
            .join(', ')}
        </div>
      )}
      {earliestNextQualifyingDate && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Earliest next qualifying test:{' '}
          {format(new Date(earliestNextQualifyingDate + 'T00:00:00'), 'EEE MMM d')}
        </div>
      )}
    </div>
  );
}

function LatestTestCard({
  test,
  today,
}: {
  test: ClassifiedTest;
  today: string;
}) {
  const daysAgo = Math.round(
    (new Date(today + 'T00:00:00').getTime() -
      new Date(test.test_date + 'T00:00:00').getTime()) /
      86400000,
  );
  const whenLabel =
    daysAgo === 0
      ? 'Today'
      : daysAgo === 1
        ? 'Yesterday'
        : `${daysAgo} days ago`;
  const classMap: Record<
    ClassifiedTest['classification'],
    { label: string; color: string; accent: string }
  > = {
    positive: {
      label: 'Positive',
      color: 'var(--accent-blush)',
      accent: 'var(--accent-blush)',
    },
    borderline: {
      label: 'Borderline',
      color: 'var(--text-primary)',
      accent: 'var(--accent-blush-light)',
    },
    negative: {
      label: 'Negative',
      color: 'var(--accent-sage)',
      accent: 'var(--accent-sage-muted)',
    },
    incomplete: {
      label: 'Incomplete',
      color: 'var(--text-muted)',
      accent: 'var(--border-light)',
    },
  };
  const cls = classMap[test.classification];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: '14px 16px',
        borderRadius: 14,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        borderLeftWidth: 3,
        borderLeftStyle: 'solid',
        borderLeftColor: cls.accent,
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
          Latest test
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{whenLabel}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span
          className="tabular"
          style={{ fontSize: 32, fontWeight: 700, color: cls.color, lineHeight: 1 }}
        >
          {test.peak_rise_bpm ?? '\u2014'}
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          bpm peak rise
        </span>
        <span
          style={{
            marginLeft: 'auto',
            padding: '3px 10px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 600,
            background: cls.accent,
            color: 'var(--text-inverse)',
          }}
        >
          {cls.label}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <StatTile
          label="Resting HR"
          value={test.resting_hr_bpm}
          unit="bpm"
        />
        <StatTile
          label="Peak standing"
          value={
            test.peak_rise_bpm !== null && test.resting_hr_bpm !== null
              ? test.resting_hr_bpm + test.peak_rise_bpm
              : null
          }
          unit="bpm"
        />
        <StatTile
          label="At 10 min"
          value={test.standing_hr_10min}
          unit="bpm"
        />
      </div>
      {test.symptoms_experienced && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Symptoms: {test.symptoms_experienced}
        </div>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | null;
  unit: string;
}) {
  return (
    <div
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
        {label}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600 }}>
        <span className="tabular">{value ?? '\u2014'}</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 3 }}>
          {unit}
        </span>
      </span>
    </div>
  );
}

function AtAGlanceCard({
  median30d,
  positiveLast60Days,
  totalTests,
}: {
  median30d: number | null;
  positiveLast60Days: number;
  totalTests: number;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8,
      }}
    >
      <StatTile label="30-day median" value={median30d} unit="bpm" />
      <StatTile
        label="Positive 60d"
        value={positiveLast60Days}
        unit={positiveLast60Days === 1 ? 'test' : 'tests'}
      />
      <StatTile label="All time" value={totalTests} unit={totalTests === 1 ? 'test' : 'tests'} />
    </div>
  );
}

function TrendSparkline({ tests }: { tests: ClassifiedTest[] }) {
  const width = 640;
  const height = 120;
  const padding = 20;
  const points = [...tests]
    .reverse()
    .filter(
      (t): t is ClassifiedTest & { peak_rise_bpm: number } =>
        t.peak_rise_bpm !== null,
    );

  if (points.length < 2) return null;

  const min = 0;
  const max = Math.max(50, ...points.map((p) => p.peak_rise_bpm));
  const xStep = (width - 2 * padding) / Math.max(1, points.length - 1);
  const plot = points.map((p, i) => {
    const x = padding + i * xStep;
    const y =
      height -
      padding -
      ((p.peak_rise_bpm - min) / (max - min)) * (height - 2 * padding);
    return { x, y, ...p };
  });
  const path = plot
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const thresholdY =
    height - padding - ((THRESHOLDS.POSITIVE_BPM - min) / (max - min)) * (height - 2 * padding);

  return (
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
        Peak rise trend
      </span>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Orthostatic peak rise trend"
      >
        {/* 30 bpm threshold reference line */}
        <line
          x1={padding}
          x2={width - padding}
          y1={thresholdY}
          y2={thresholdY}
          stroke="var(--accent-blush-light)"
          strokeDasharray="4 3"
        />
        <text
          x={width - padding}
          y={thresholdY - 4}
          textAnchor="end"
          fontSize="10"
          fill="var(--accent-blush)"
        >
          30 bpm
        </text>
        <path
          d={path}
          fill="none"
          stroke="var(--accent-sage)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {plot.map((p) => (
          <circle
            key={p.id}
            cx={p.x}
            cy={p.y}
            r="3"
            fill={
              p.classification === 'positive'
                ? 'var(--accent-blush)'
                : p.classification === 'borderline'
                  ? 'var(--accent-blush-light)'
                  : 'var(--accent-sage)'
            }
          />
        ))}
      </svg>
    </div>
  );
}

function ExplainerCard() {
  return (
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, lineHeight: 1.55 }}>
        <p style={{ margin: 0 }}>
          <strong>Peak rise</strong> is how much your standing heart rate exceeded
          your resting heart rate, at the highest minute during the 10-minute
          test. It&rsquo;s the single most important number here.
        </p>
        <p style={{ margin: 0 }}>
          <strong>30 bpm or more</strong> sustained for 10 minutes is the POTS
          positive threshold (40 bpm for teens). A positive day is not a
          diagnosis on its own. Clinicians typically want 3 positives at
          least 2 weeks apart before formally diagnosing.
        </p>
        <p style={{ margin: 0 }}>
          <strong>20-29 bpm</strong> is borderline. It can mean orthostatic
          intolerance without meeting full POTS criteria. Worth tracking.
        </p>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>
          Hydration in the 2 hours before the test and caffeine intake can
          both shift results. Log them when you can so the pattern is easier
          to read.
        </p>
      </div>
    </div>
  );
}
