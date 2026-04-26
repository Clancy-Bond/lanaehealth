'use client'
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
 *
 * Beside the meal label sits a small info button that opens a
 * MealTimingExplainer modal in the Oura "Sleep regularity"
 * educational style established by PR #45 + #46. Splitting the info
 * tap from the expand/collapse tap keeps both interactions
 * unambiguous.
 *
 * Density (Oura-restrained):
 *   The dashboard renders four meal cards. Stacking all four expanded
 *   eats the mid-fold and reads as form-dense rather than calm. The
 *   page passes `defaultExpanded` based on time-of-day so only the
 *   current meal opens; the others render as a single row (label +
 *   total cal + chevron) and expand on tap. Matches Oura's "show the
 *   relevant signal now, drill in for the rest" pattern.
 */
import { useState } from 'react'
import Link from 'next/link'
import { Card } from '@/v2/components/primitives'
import MealRowKebab from './MealRowKebab'
import MealItemEditSheet from './MealItemEditSheet'
import { MealTimingExplainer } from '../food/_components/MetricExplainers'

export interface MealSectionEntry {
  id: string
  food_items: string | null
  calories: number | null
  macros: Record<string, number> | null
  /** Optional Open Food Facts photo URL. Populated by the page-level
   *  loader via lookupFoodPhotosByName. Renders as a 40px circle at
   *  the leading edge of each item row when present; rows without a
   *  photo render no leading element (the food label aligns left). */
  photoUrl?: string | null
}

/*
 * MFN food row composition. The legacy display name combines several
 * pieces of info into one string at log time:
 *   "Apple, raw (1x 1 medium 118g)"   USDA + portion + grams
 *   "Bananas (118g)"                  USDA + grams only
 *   "Peanut butter, Skippy (32g)"     USDA + brand + grams
 * The MFN row layout splits this into three lines of typography:
 *   bold name        |  cal (right)
 *   muted portion    |
 * splitFoodLabel does its best to extract the parenthesized portion
 * suffix and surface it on the second line, falling back to a quiet
 * empty subline when no portion info is present (still keeps row
 * heights uniform).
 */
export function splitFoodLabel(raw: string): { name: string; portion: string | null } {
  const trimmed = raw.trim()
  // Match a trailing parenthesized group: "Name (portion)". Greedy on
  // the last paren so names containing parens earlier still resolve.
  const match = trimmed.match(/^(.*)\(([^()]*)\)\s*$/)
  if (!match) return { name: trimmed, portion: null }
  const [, namePart, portionPart] = match
  const cleanName = namePart.trim().replace(/[,\s]+$/, '')
  const cleanPortion = portionPart.trim()
  if (!cleanName) return { name: trimmed, portion: null }
  return { name: cleanName, portion: cleanPortion || null }
}

export interface MealSectionCardProps {
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  label: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack'
  date: string
  entries: MealSectionEntry[]
  /** Whether the card opens expanded. Default false; the page sets
   *  true for the meal whose time window contains "now". */
  defaultExpanded?: boolean
}

const EMPTY_COPY: Record<MealSectionCardProps['meal'], string> = {
  breakfast: 'Tap to log breakfast. An empty meal is a signal too.',
  lunch: 'Tap to log lunch. An empty meal is a signal too.',
  dinner: 'Tap to log dinner. An empty meal is a signal too.',
  snack: 'Tap to log a snack. An empty meal is a signal too.',
}

function InfoIconButton({
  onClick,
  ariaLabel,
}: {
  onClick: () => void
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      aria-label={ariaLabel}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 24,
        height: 24,
        borderRadius: 'var(--v2-radius-full)',
        background: 'transparent',
        border: '1px solid var(--v2-border)',
        padding: 0,
        margin: 0,
        cursor: 'pointer',
        color: 'var(--v2-text-muted)',
        font: 'inherit',
        flexShrink: 0,
      }}
    >
      {/* Expand hit area to >=44pt without changing visual icon size. */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 'var(--v2-touch-target-min)',
          height: 'var(--v2-touch-target-min)',
          transform: 'translate(-50%, -50%)',
        }}
      />
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

export default function MealSectionCard({
  meal,
  label,
  date,
  entries,
  defaultExpanded = false,
}: MealSectionCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [explainerOpen, setExplainerOpen] = useState(false)
  const total = entries.reduce((acc, e) => acc + (e.calories ?? 0), 0)
  const isEmpty = entries.length === 0
  const searchHref = `/v2/calories/search?view=search&meal=${meal}&date=${date}`

  const explainer = (
    <MealTimingExplainer
      open={explainerOpen}
      onClose={() => setExplainerOpen(false)}
      meal={meal}
      entryCount={entries.length}
      totalCalories={total}
    />
  )

  // Collapsed state: render a single tappable row with chevron. Tap
  // expands in place. Keeps the page's vertical rhythm Oura-restrained.
  //
  // Layout note: the expand button and the InfoIconButton are
  // siblings inside a flex row, NOT nested. Nesting <button> inside
  // <button> is invalid HTML and triggers React hydration error #418
  // because the browser auto-corrects the nesting at parse time, so
  // the client DOM no longer matches the server-rendered HTML.
  if (!expanded) {
    return (
      <Card padding="none">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            padding: 'var(--v2-space-3) var(--v2-space-4)',
            minHeight: 'var(--v2-touch-target-min)',
          }}
        >
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-expanded={false}
            aria-label={`Expand ${label.toLowerCase()}, ${Math.round(total)} calories`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flex: 1,
              minWidth: 0,
              minHeight: 'var(--v2-touch-target-min)',
              background: 'transparent',
              border: 0,
              padding: 0,
              cursor: 'pointer',
              color: 'inherit',
              fontFamily: 'inherit',
              textAlign: 'left',
              borderRadius: 'var(--v2-radius-lg)',
            }}
          >
            <span
              style={{
                fontSize: 'var(--v2-text-base)',
                fontWeight: 'var(--v2-weight-semibold)',
                color: 'var(--v2-text-primary)',
              }}
            >
              {label}
            </span>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--v2-space-2)',
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-text-muted)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span>{Math.round(total)} cal</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden
                style={{ flexShrink: 0 }}
              >
                <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
          <span style={{ marginLeft: 'var(--v2-space-2)', flexShrink: 0 }}>
            <InfoIconButton
              onClick={() => setExplainerOpen(true)}
              ariaLabel={`Open ${label.toLowerCase()} timing explainer`}
            />
          </span>
        </div>
        {explainer}
      </Card>
    )
  }

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
            width: '100%',
          }}
        >
          {/* Sibling buttons (collapse + info), NOT nested. See note
              in the collapsed branch above: nested <button> is invalid
              HTML and triggers React hydration error #418. */}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--v2-space-2)' }}>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-expanded={true}
              aria-label={`Collapse ${label.toLowerCase()}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: 'transparent',
                border: 0,
                padding: 0,
                cursor: 'pointer',
                color: 'inherit',
                fontFamily: 'inherit',
                textAlign: 'left',
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
            </button>
            <InfoIconButton
              onClick={() => setExplainerOpen(true)}
              ariaLabel={`Open ${label.toLowerCase()} timing explainer`}
            />
          </span>
          <span
            style={{
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-muted)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {Math.round(total)} cal
          </span>
        </div>

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
              const rawName = e.food_items?.trim() || '(unnamed)'
              const { name, portion } = splitFoodLabel(rawName)
              const cal = Math.round(e.calories ?? 0)
              const isLast = i === entries.length - 1
              return (
                <li key={e.id}>
                  <MealItemRow
                    entry={e}
                    name={name}
                    portion={portion}
                    cal={cal}
                    divider={!isLast}
                    date={date}
                    meal={meal}
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
      {explainer}
    </Card>
  )
}

/*
 * MealItemRow
 *
 * MFN-grade row: leading 40px circle photo, two-line text (bold name +
 * muted portion line), right-aligned tabular calories, kebab. The
 * entire row (excluding the kebab) is a tap target that opens the
 * MealItemEditSheet for in-place servings edit.
 *
 * Frame anchor: docs/reference/mynetdiary/diary food rows. Bold-name +
 * lighter-portion is the consistent typography ladder there. We don't
 * yet store brand separately (food_items is a single denormalised
 * string from the legacy log route), so the second line is the
 * portion suffix parsed by splitFoodLabel. Empty portion still renders
 * as a uniform-height empty subline (CSS preserves the row rhythm).
 */
function MealItemRow({
  entry,
  name,
  portion,
  cal,
  divider,
  date,
  meal,
}: {
  entry: MealSectionEntry
  name: string
  portion: string | null
  cal: number
  divider: boolean
  date: string
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack'
}) {
  const [editOpen, setEditOpen] = useState(false)
  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--v2-space-3)',
          minHeight: 'var(--v2-touch-target-min)',
          padding: 'var(--v2-space-3) 0',
          borderBottom: divider ? '1px solid var(--v2-border-subtle)' : 'none',
        }}
      >
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          aria-label={`Edit ${name}, ${cal} calories`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--v2-space-3)',
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 0,
            padding: 0,
            cursor: 'pointer',
            color: 'inherit',
            fontFamily: 'inherit',
            textAlign: 'left',
            minHeight: 'var(--v2-touch-target-min)',
          }}
        >
          {entry.photoUrl ? (
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                overflow: 'hidden',
                flexShrink: 0,
                background: 'var(--v2-bg-card-muted, rgba(255,255,255,0.04))',
                border: '1px solid var(--v2-border-subtle)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={entry.photoUrl}
                alt=""
                width={40}
                height={40}
                loading="lazy"
                decoding="async"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>
          ) : (
            <div
              aria-hidden
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                flexShrink: 0,
                background: 'var(--v2-bg-card-muted, rgba(255,255,255,0.04))',
                border: '1px solid var(--v2-border-subtle)',
              }}
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 'var(--v2-text-base)',
                fontWeight: 'var(--v2-weight-semibold)',
                color: 'var(--v2-text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {name}
            </div>
            <div
              style={{
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-text-muted)',
                marginTop: 2,
                fontWeight: 'var(--v2-weight-regular)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minHeight: '1em',
              }}
            >
              {portion ?? 'Tap to edit'}
            </div>
          </div>
          <div
            style={{
              flexShrink: 0,
              fontSize: 'var(--v2-text-base)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)',
              fontVariantNumeric: 'tabular-nums',
              textAlign: 'right',
              minWidth: 56,
            }}
          >
            {cal}
            <span
              style={{
                fontSize: 'var(--v2-text-xs)',
                fontWeight: 'var(--v2-weight-regular)',
                color: 'var(--v2-text-muted)',
                marginLeft: 4,
              }}
            >
              cal
            </span>
          </div>
        </button>
        <MealRowKebab entryId={entry.id} date={date} meal={meal} foodLabel={name} />
      </div>
      <MealItemEditSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        entryId={entry.id}
        foodLabel={name}
        baseCalories={cal}
        startingServings={1}
      />
    </>
  )
}
