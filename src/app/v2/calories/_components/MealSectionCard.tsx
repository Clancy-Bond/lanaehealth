/*
 * MealSectionCard
 *
 * One meal bucket: header (label + total cal), then either a list
 * of food rows with per-row kebab, or the empty-state line. Always
 * ends with an inline "Add to {meal}" row so Lanae can log without
 * hitting the FAB. Empty meals read as a soft nudge, not a scold:
 * "An empty meal is a signal too" preserves NC voice.
 *
 * Header kebab is reserved for a future bulk "Move" action; omitted
 * in Session 02 to keep this card simple.
 */
import Link from 'next/link'
import { Card, ListRow } from '@/v2/components/primitives'
import MealRowKebab from './MealRowKebab'

export interface MealSectionEntry {
  id: string
  food_items: string | null
  calories: number | null
  macros: Record<string, number> | null
}

export interface MealSectionCardProps {
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  label: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack'
  date: string
  entries: MealSectionEntry[]
}

const EMPTY_COPY: Record<MealSectionCardProps['meal'], string> = {
  breakfast: 'Tap to log breakfast. An empty meal is a signal too.',
  lunch: 'Tap to log lunch. An empty meal is a signal too.',
  dinner: 'Tap to log dinner. An empty meal is a signal too.',
  snack: 'Tap to log a snack. An empty meal is a signal too.',
}

export default function MealSectionCard({ meal, label, date, entries }: MealSectionCardProps) {
  const total = entries.reduce((acc, e) => acc + (e.calories ?? 0), 0)
  const isEmpty = entries.length === 0
  const searchHref = `/v2/calories/search?view=search&meal=${meal}&date=${date}`

  return (
    <Card padding="md">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-2)',
        }}
      >
        <header
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
              fontSize: 'var(--v2-text-base)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)',
            }}
          >
            {label}
          </h3>
          <span
            style={{
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-muted)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {Math.round(total)} cal
          </span>
        </header>

        {isEmpty ? (
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-muted)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            {EMPTY_COPY[meal]}
          </p>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {entries.map((e, i) => {
              const name = e.food_items?.trim() || '(unnamed)'
              const cal = Math.round(e.calories ?? 0)
              const isLast = i === entries.length - 1
              return (
                <li key={e.id}>
                  <ListRow
                    divider={!isLast}
                    label={name}
                    subtext={`${cal} cal`}
                    trailing={
                      <MealRowKebab
                        entryId={e.id}
                        date={date}
                        meal={meal}
                        foodLabel={name}
                      />
                    }
                  />
                </li>
              )
            })}
          </ul>
        )}

        <Link
          href={searchHref}
          aria-label={`Add to ${label.toLowerCase()}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: 'var(--v2-touch-target-min)',
            padding: 'var(--v2-space-3) var(--v2-space-3)',
            marginTop: isEmpty ? 'var(--v2-space-2)' : 0,
            borderRadius: 'var(--v2-radius-md)',
            background: 'var(--v2-accent-primary-soft)',
            color: 'var(--v2-accent-primary)',
            fontSize: 'var(--v2-text-sm)',
            fontWeight: 'var(--v2-weight-semibold)',
            textDecoration: 'none',
          }}
        >
          <span>{`Add to ${label.toLowerCase()}`}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
            <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </Card>
  )
}
