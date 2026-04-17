'use client'

/**
 * Nutrient x Lab Alerts Card
 *
 * Renders the flagship Cronometer cross-reference alerts on the /patterns
 * page. Reads the three inputs from the caller and formats each alert
 * with warm modern tokens, non-diagnostic copy, and a citation footnote.
 *
 * Mount on /patterns page only when a parent page passes the props.
 * The standalone nature lets us defer the mount decision without
 * touching contested route files.
 *
 * See:
 *   src/lib/intelligence/nutrient-lab-alerts.ts (engine)
 *   src/lib/nutrition/nutrient-lab-map.ts (mappings)
 *   docs/competitive/cronometer/implementation-notes.md Feature 1
 */

import type { NutrientLabAlert } from '@/lib/intelligence/nutrient-lab-alerts'

interface NutrientLabAlertsCardProps {
  alerts: NutrientLabAlert[]
  /**
   * When present, shown under the header. Use to surface data coverage
   * ("from 14 days of meals" etc). Optional for now.
   */
  coverageNote?: string
}

const SEVERITY_STYLES: Record<NutrientLabAlert['severity'], { bg: string; color: string; label: string }> = {
  action: {
    bg: 'rgba(212, 160, 160, 0.14)',
    color: '#B66A6A',
    label: 'Action',
  },
  watch: {
    bg: 'rgba(232, 168, 73, 0.12)',
    color: '#E8A849',
    label: 'Watch',
  },
  info: {
    bg: 'rgba(107, 144, 128, 0.12)',
    color: '#6B9080',
    label: 'Info',
  },
}

function AlertTile({ alert }: { alert: NutrientLabAlert }) {
  const style = SEVERITY_STYLES[alert.severity]

  return (
    <article
      className="rounded-xl p-4"
      style={{
        background: 'var(--surface, #FFFFFF)',
        border: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      }}
    >
      <header className="flex items-start justify-between gap-3">
        <h3
          className="text-base font-semibold"
          style={{ color: 'var(--text-primary, #2B2B2B)' }}
        >
          {alert.title}
        </h3>
        <span
          className="text-xs font-medium rounded-full px-2 py-0.5"
          style={{ background: style.bg, color: style.color }}
        >
          {style.label}
        </span>
      </header>

      <p
        className="mt-2 text-sm leading-relaxed"
        style={{ color: 'var(--text-body, #3C3C3C)' }}
      >
        {alert.body}
      </p>

      {alert.suggestedFoods.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {alert.suggestedFoods.map((food) => (
            <li
              key={food}
              className="text-xs rounded-full px-2.5 py-1"
              style={{
                background: 'rgba(107, 144, 128, 0.08)',
                color: '#6B9080',
              }}
            >
              {food}
            </li>
          ))}
        </ul>
      )}

      <footer
        className="mt-3 text-[11px] leading-relaxed"
        style={{ color: 'var(--text-muted, #7A7A7A)' }}
      >
        Source: {alert.citation}
      </footer>
    </article>
  )
}

export default function NutrientLabAlertsCard({
  alerts,
  coverageNote,
}: NutrientLabAlertsCardProps) {
  if (alerts.length === 0) {
    return (
      <section
        className="rounded-2xl p-5"
        style={{
          background: 'var(--surface, #FAFAF7)',
          border: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
        }}
      >
        <header>
          <h2
            className="text-lg font-semibold"
            style={{ color: 'var(--text-primary, #2B2B2B)' }}
          >
            Nutrient and lab cross-reference
          </h2>
          <p
            className="mt-1 text-sm"
            style={{ color: 'var(--text-muted, #7A7A7A)' }}
          >
            No alerts right now. This card lights up when a recent lab
            value and your recent intake suggest a nutrient worth
            discussing with your doctor.
          </p>
        </header>
      </section>
    )
  }

  return (
    <section
      className="rounded-2xl p-5"
      style={{
        background: 'var(--surface, #FAFAF7)',
        border: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
      }}
    >
      <header className="mb-4">
        <h2
          className="text-lg font-semibold"
          style={{ color: 'var(--text-primary, #2B2B2B)' }}
        >
          Nutrient and lab cross-reference
        </h2>
        <p
          className="mt-1 text-sm"
          style={{ color: 'var(--text-muted, #7A7A7A)' }}
        >
          Suggestions that pair your lab results with your tracked
          intake. Not a diagnosis. Share these with your doctor.
          {coverageNote ? ` ${coverageNote}` : ''}
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {alerts.map((alert) => (
          <AlertTile key={alert.id} alert={alert} />
        ))}
      </div>
    </section>
  )
}
