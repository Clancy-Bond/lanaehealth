/*
 * Renders one CycleInsight row. Layout: label, two stat columns
 * (you / population), arrow chip indicating the comparison verdict,
 * and the NC-voice interpretation underneath.
 *
 * Confidence badge is displayed when sample size is small (low
 * confidence), so the user reads "preliminary" before they read the
 * comparison.
 */
import type { CycleInsight } from '@/lib/cycle/cycle-insights'
import { Card } from '@/v2/components/primitives'

export default function InsightRow({ insight }: { insight: CycleInsight }) {
  const userTxt = formatUser(insight.userValue)
  const popTxt = formatPopulation(insight.populationValue)
  return (
    <Card padding="md">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-2)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 'var(--v2-space-2)',
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-md)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)',
              letterSpacing: 'var(--v2-tracking-tight)',
            }}
          >
            {insight.label}
          </h3>
          <ComparisonBadge comparison={insight.comparison} />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--v2-space-2)',
          }}
        >
          <Stat label="You" value={userTxt} highlighted />
          <Stat label="All cyclers" value={popTxt} />
        </div>

        <p
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-secondary)',
            lineHeight: 'var(--v2-leading-relaxed)',
          }}
        >
          {insight.comparisonText}
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--v2-space-2)',
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-text-muted)',
          }}
        >
          <span>Source: {insight.populationValue.source}</span>
          {insight.confidence === 'low' && <span aria-label="Preliminary insight">Preliminary</span>}
          {insight.confidence === 'medium' && <span>Building confidence</span>}
          {insight.confidence === 'high' && <span>High confidence</span>}
        </div>
      </div>
    </Card>
  )
}

function Stat({ label, value, highlighted }: { label: string; value: string; highlighted?: boolean }) {
  return (
    <div
      style={{
        background: highlighted ? 'var(--v2-bg-tile)' : 'transparent',
        border: highlighted ? '1px solid var(--v2-border-subtle)' : '1px dashed var(--v2-border-subtle)',
        borderRadius: 'var(--v2-radius-md)',
        padding: 'var(--v2-space-3)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <span
        style={{
          fontSize: 'var(--v2-text-xs)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--v2-tracking-wide)',
          color: 'var(--v2-text-muted)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 'var(--v2-text-md)',
          fontWeight: 'var(--v2-weight-semibold)',
          color: 'var(--v2-text-primary)',
        }}
      >
        {value}
      </span>
    </div>
  )
}

function ComparisonBadge({ comparison }: { comparison: CycleInsight['comparison'] }) {
  if (comparison === 'unknown') return null
  const label =
    comparison === 'similar'
      ? 'Similar'
      : comparison === 'longer'
        ? 'Longer'
        : 'Shorter'
  const tone =
    comparison === 'similar'
      ? 'rgba(106, 207, 137, 0.18)'
      : comparison === 'longer'
        ? 'rgba(155, 127, 224, 0.18)'
        : 'rgba(229, 201, 82, 0.18)'
  return (
    <span
      style={{
        background: tone,
        color: 'var(--v2-text-primary)',
        borderRadius: 'var(--v2-radius-full)',
        padding: '4px 10px',
        fontSize: 'var(--v2-text-xs)',
        fontWeight: 'var(--v2-weight-medium)',
      }}
    >
      {label}
    </span>
  )
}

function formatUser(v: CycleInsight['userValue']): string {
  if (!v || v.sampleSize === 0) return 'Not enough data'
  if (v.sd > 0) return `${v.mean} +/- ${v.sd} d`
  return `${v.mean} d`
}

function formatPopulation(v: CycleInsight['populationValue']): string {
  if (v.sd > 0) return `${v.mean} +/- ${v.sd} d`
  return `${v.mean} d`
}
