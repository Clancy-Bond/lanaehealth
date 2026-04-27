/**
 * SummaryFoodsPanel (MFN parity rewrite, 2026-04-27)
 *
 * Mirrors `docs/reference/mynetdiary/frames/full-tour/frame_0010.png`
 * "Recent Foods Providing Most Calories" section.
 *
 *   🥯  Morning rounds blueberry by Ozery Bakery
 *       provided 1,600 cals in previous 5 days
 *
 *   🍚  White rice
 *       provided 911 cals in previous 3 days
 *
 *   🌮  Crunch wrap supreme by Taco Bell
 *       provided 795 cals in previous 2 days
 *
 * Flat list of rich rows (NOT a boxed Card stack). Each row shows
 * a small circular photo, the food name on the first line, and an
 * MFN-shaped "provided X cals in previous Y days" subline.
 *
 * Why the rewrite:
 * - Previous design used the generic v2 ListRow + Card wrapper. The
 *   visual was correct but the copy ("3 logs / 1,200 cal") didn't
 *   read like MFN. The new shape uses MFN's exact phrasing so the
 *   page reads as an MFN clone instead of an MFN-flavored cousin.
 * - The photo is a 36pt circular thumb consistent with the All
 *   Meals view (see MfnAllMealsList) for cross-surface harmony.
 *
 * Photos are not yet wired through `topContributors`; the rows fall
 * back to the colored letter badge from PR #64. Adding photos here
 * would require feeding fdcId or food_name through the aggregator
 * and a Map<key, photoUrl> from lookupFoodPhotosByName. That's a
 * follow-up; the rest of the row is shippable today.
 */
import { EmptyState } from '@/v2/components/primitives'
import type { TopContributor } from './derive'

export interface SummaryFoodsPanelProps {
  contributors: TopContributor[]
  loggedDays: number
}

export default function SummaryFoodsPanel({
  contributors,
  loggedDays,
}: SummaryFoodsPanelProps) {
  if (loggedDays < 3) {
    return (
      <div style={{ padding: 'var(--v2-space-4)' }}>
        <EmptyState
          headline="Not enough days yet"
          subtext="A few more logged days will give a useful picture. Come back after a week of food entries."
        />
      </div>
    )
  }

  if (contributors.length === 0) {
    return (
      <div style={{ padding: 'var(--v2-space-4)' }}>
        <EmptyState
          headline="No food entries in this window"
          subtext="Log a few meals and this list will fill in."
        />
      </div>
    )
  }

  return (
    <section
      aria-label="Recent foods providing most calories"
      style={{
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          padding: 'var(--v2-space-3) var(--v2-space-4)',
          background: 'var(--v2-bg-surface)',
          borderTop: '1px solid var(--v2-border-subtle)',
          borderBottom: '1px solid var(--v2-border-subtle)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--v2-text-base)',
            fontWeight: 'var(--v2-weight-bold)',
            color: 'var(--v2-text-primary)',
          }}
        >
          Recent Foods Providing Most Calories
        </span>
      </header>
      {contributors.map((row) => (
        <ContributorRow key={row.key} row={row} loggedDays={loggedDays} />
      ))}
    </section>
  )
}

function ContributorRow({
  row,
  loggedDays,
}: {
  row: TopContributor
  loggedDays: number
}) {
  // "provided X cals in previous Y days" mirrors MFN exactly.
  // Y is min(row.count, loggedDays) so a food eaten 3 distinct days
  // out of a 7-day window reads "in previous 3 days" not "7 days".
  const dayLabel = Math.min(row.count, loggedDays)
  const calsLabel = Math.round(row.calories).toLocaleString()
  const dayWord = dayLabel === 1 ? 'day' : 'days'

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'center',
        gap: 'var(--v2-space-3)',
        padding: 'var(--v2-space-3) var(--v2-space-4)',
        background: 'var(--v2-bg-card)',
        borderBottom: '1px solid var(--v2-border-subtle)',
      }}
    >
      <ContributorBadge name={row.display} />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 'var(--v2-text-base)',
            color: 'var(--v2-text-primary)',
            fontWeight: 'var(--v2-weight-semibold)',
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {row.display}
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-text-muted)',
            lineHeight: 1.3,
          }}
        >
          provided{' '}
          <span
            style={{
              color: 'var(--v2-text-secondary)',
              fontWeight: 'var(--v2-weight-semibold)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {calsLabel} cals
          </span>{' '}
          in previous {dayLabel} {dayWord}
        </div>
      </div>
    </div>
  )
}

const PALETTE: Array<{ bg: string; ring: string; text: string }> = [
  { bg: 'rgba(229, 201, 82, 0.18)', ring: 'rgba(229, 201, 82, 0.55)', text: '#E5C952' },
  { bg: 'rgba(77, 184, 168, 0.18)', ring: 'rgba(77, 184, 168, 0.55)', text: '#4DB8A8' },
  { bg: 'rgba(183, 156, 217, 0.20)', ring: 'rgba(183, 156, 217, 0.60)', text: '#B79CD9' },
  { bg: 'rgba(232, 168, 124, 0.18)', ring: 'rgba(232, 168, 124, 0.55)', text: '#E8A87C' },
  { bg: 'rgba(140, 198, 119, 0.18)', ring: 'rgba(140, 198, 119, 0.55)', text: '#8CC677' },
  { bg: 'rgba(220, 130, 130, 0.18)', ring: 'rgba(220, 130, 130, 0.55)', text: '#DC8282' },
]

function pickPaletteIndex(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return hash % PALETTE.length
}

function ContributorBadge({ name }: { name: string }) {
  const trimmed = name.trim()
  const letter = (trimmed[0] ?? '?').toUpperCase()
  const palette = PALETTE[pickPaletteIndex(trimmed.toLowerCase())]
  return (
    <div
      aria-hidden
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: palette.bg,
        border: `1px solid ${palette.ring}`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 'var(--v2-text-base)',
        fontWeight: 'var(--v2-weight-bold)',
        color: palette.text,
        flexShrink: 0,
      }}
    >
      {letter}
    </div>
  )
}
