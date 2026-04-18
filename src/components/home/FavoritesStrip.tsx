/**
 * User-curated FavoritesStrip for the home page (Wave 2e F5).
 *
 * Reads the pinned metric list from health_profile (section='home_favorites')
 * and renders a horizontal tile strip next to the existing QuickStatusStrip.
 * Lanae picks what she wants to see at a glance (standing pulse, HRV, cycle
 * day, pain, etc) and the strip reshuffles to match. Caps at 6 tiles.
 *
 * Empty state prompts "Add a favorite" and deep-links to /settings where the
 * editor lives. Mount in src/app/page.tsx so the home layout picks up the
 * user preference each render (page is already force-dynamic).
 */
import Link from 'next/link'
import {
  FAVORITE_METRIC_DEFINITIONS,
  type FavoriteItem,
  type FavoriteMetricId,
} from '@/lib/api/favorites'
import { InfoTip } from '@/components/ui/InfoTip'

// --- values --------------------------------------------------------------

/**
 * Data bag for computing tile values. Every field is optional so the home
 * page can compute only what it needs; unknown metrics render "--" rather
 * than throwing.
 */
export interface FavoritesMetricValues {
  standingPulse?: number | null
  hrv?: number | null
  rhr?: number | null
  bodyTempF?: number | null
  cycleDay?: number | null
  cyclePhaseLabel?: string | null
  overallPain?: number | null
  fatigue?: number | null
  sleepScore?: number | null
  readiness?: number | null
  topLabLabel?: string | null
  topLabValue?: string | null
}

export interface FavoriteTileValue {
  label: string
  value: string
  unit?: string
  /** Deep link to the detail page for this metric. */
  href: string
}

const METRIC_DEFS_BY_ID = new Map(
  FAVORITE_METRIC_DEFINITIONS.map((d) => [d.id, d] as const),
)

function formatNumber(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '--'
  return digits === 0 ? String(Math.round(v)) : v.toFixed(digits)
}

/**
 * Pure resolver: (pinned item, current values) -> tile data. Exported so
 * tests can cover the branches without a React renderer.
 */
export function resolveFavoriteTile(
  item: FavoriteItem,
  values: FavoritesMetricValues,
): FavoriteTileValue {
  const def = METRIC_DEFS_BY_ID.get(item.metric)
  const label = item.displayAs?.trim() || def?.label || item.metric

  switch (item.metric) {
    case 'standing_pulse':
      return {
        label,
        value: formatNumber(values.standingPulse),
        unit: 'bpm',
        href: '/patterns?metric=standing_pulse',
      }
    case 'hrv':
      return {
        label,
        value: formatNumber(values.hrv),
        unit: 'ms',
        href: '/patterns?metric=hrv',
      }
    case 'rhr':
      return {
        label,
        value: formatNumber(values.rhr),
        unit: 'bpm',
        href: '/patterns?metric=rhr',
      }
    case 'body_temp':
      return {
        label,
        value: formatNumber(values.bodyTempF, 1),
        unit: 'F',
        href: '/patterns?metric=body_temp',
      }
    case 'cycle_day':
      return {
        label,
        value:
          values.cycleDay !== null && values.cycleDay !== undefined
            ? String(values.cycleDay)
            : '--',
        href: '/patterns?metric=cycle',
      }
    case 'cycle_phase':
      return {
        label,
        value: values.cyclePhaseLabel || '--',
        href: '/patterns?metric=cycle',
      }
    case 'overall_pain':
      return {
        label,
        value: formatNumber(values.overallPain),
        unit: '/10',
        href: '/patterns?metric=pain',
      }
    case 'fatigue':
      return {
        label,
        value: formatNumber(values.fatigue),
        unit: '/10',
        href: '/patterns?metric=fatigue',
      }
    case 'sleep_score':
      return {
        label,
        value: formatNumber(values.sleepScore),
        href: '/patterns?metric=sleep',
      }
    case 'readiness':
      return {
        label,
        value: formatNumber(values.readiness),
        href: '/patterns?metric=readiness',
      }
    case 'top_lab':
      return {
        label: values.topLabLabel || label,
        value: values.topLabValue || '--',
        href: '/records',
      }
  }

  // Exhaustiveness guard -- should be unreachable because FavoriteMetricId
  // is a closed union.
  const _never: never = item.metric
  return {
    label,
    value: '--',
    href: '/settings',
  }
  void _never
}

// --- component -----------------------------------------------------------

interface Props {
  /**
   * Pinned items from the health_profile row, already parsed + capped by
   * getFavorites(). Empty array renders the empty-state CTA.
   */
  items: FavoriteItem[]
  /** Current metric values for rendering. */
  values: FavoritesMetricValues
}

export function FavoritesStrip({ items, values }: Props) {
  // Empty state: nudge the user to set this up in settings.
  if (items.length === 0) {
    return (
      <div style={{ padding: '0 16px' }}>
        <Link
          href="/settings#favorites"
          className="press-feedback"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '12px 16px',
            borderRadius: 14,
            background: 'var(--bg-card)',
            border: '1px dashed var(--border-light)',
            boxShadow: 'var(--shadow-sm)',
            textDecoration: 'none',
            color: 'var(--text-primary)',
            transition:
              'transform var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              Favorites on home
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Pick a few metrics to see at a glance
            </span>
          </div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              padding: '6px 12px',
              borderRadius: 999,
              background: 'transparent',
              border: '1px solid var(--border)',
              whiteSpace: 'nowrap',
            }}
          >
            Add a favorite
          </span>
        </Link>
      </div>
    )
  }

  const tiles = items.map((item) => ({
    key: item.metric,
    ...resolveFavoriteTile(item, values),
  }))

  return (
    <div style={{ padding: '0 16px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.03em',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
          }}
        >
          Your favorites
          <InfoTip
            what="Tiles you pinned to the top of your home screen for at-a-glance access."
            matters="The point is to surface what matters most to you right now without scrolling. Edit them anytime."
          />
        </span>
        <Link
          href="/settings#favorites"
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--text-muted)',
            textDecoration: 'none',
          }}
        >
          Edit
        </Link>
      </div>
      <div
        className="hide-scrollbar"
        style={{
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div style={{ display: 'flex', gap: 8, paddingBottom: 4 }}>
          {tiles.map((t) => (
            <Link
              key={t.key}
              href={t.href}
              className="touch-target press-feedback"
              style={{
                flex: 1,
                minWidth: 88,
                height: 70,
                borderRadius: 14,
                background:
                  'linear-gradient(180deg, #FFFFFF 0%, #FDFDFB 100%)',
                border: 'none',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                textDecoration: 'none',
                flexShrink: 0,
                padding: '10px 12px',
                transition:
                  'transform var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard)',
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  fontWeight: 400,
                  lineHeight: 1,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.label}
              </span>
              <div
                style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}
              >
                <span
                  className={t.value !== '--' ? 'tabular' : undefined}
                  style={{
                    fontSize: t.value === '--' ? 14 : 18,
                    fontWeight: 700,
                    color:
                      t.value === '--'
                        ? 'var(--text-muted)'
                        : 'var(--text-primary)',
                    lineHeight: 1,
                  }}
                >
                  {t.value}
                </span>
                {t.unit && t.value !== '--' && (
                  <span
                    className="tabular"
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      fontWeight: 400,
                    }}
                  >
                    {t.unit}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
