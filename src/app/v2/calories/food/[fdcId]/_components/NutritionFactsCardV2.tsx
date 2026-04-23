'use client'

/*
 * LEARNING-MODE HOOK G6: Nutrition Facts density.
 *
 * Option A (collapsed, ship): macros + calories in a compact card; tap
 *   "Show full label" to expand the FDA-style table. Honors
 *   docs/reference/mynetdiary/flows.md:33: "too dense for v2's preferred
 *   disclosure."
 *
 * Option B (always expanded): full FDA card always visible. Matches MFN
 *   parity more closely but steals vertical space on 375pt viewports.
 *
 * Swap: change initialMode prop from 'collapsed' to 'expanded'.
 */

import { ReactNode, useState } from 'react'
import { Card } from '@/v2/components/primitives'
import { useFoodDetail } from './FoodDetailHero'

// FDA % Daily Value targets (2,000 kcal reference diet).
const DV = {
  fat: 78, satFat: 20, sodium: 2300, carbs: 275, fiber: 28, protein: 50,
  calcium: 1300, iron: 18, potassium: 4700, vitaminC: 90, vitaminD: 20,
} as const

const DASH = '--'

function pctDV(value: number | null | undefined, target: number): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return ''
  return `${Math.round((value / target) * 100)}%`
}

function fmt(value: number | null | undefined, unit: string, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH
  const n = digits === 0 ? Math.round(value) : Number(value.toFixed(digits))
  return `${n} ${unit}`
}

export interface NutritionFactsCardV2Props {
  initialMode?: 'collapsed' | 'expanded'
}

export default function NutritionFactsCardV2({
  initialMode = 'collapsed',
}: NutritionFactsCardV2Props) {
  const { scaled, selectedPortion, gramsEaten, nutrients } = useFoodDetail()
  const [expanded, setExpanded] = useState(initialMode === 'expanded')
  const unit = nutrients.servingUnit ?? 'g'
  const servingLabel = `${selectedPortion.label} · ${Math.round(gramsEaten)} ${unit}`
  const calories = scaled.calories !== null ? Math.round(scaled.calories) : null

  return (
    <Card padding="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
        <header
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 'var(--v2-space-3)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--v2-text-xs)', fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-muted)', textTransform: 'uppercase',
              letterSpacing: 'var(--v2-tracking-wide)',
            }}
          >
            Nutrition Facts
          </span>
          <span
            style={{
              fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {servingLabel}
          </span>
        </header>

        {!expanded && (
          <MacroSummary
            calories={calories}
            protein={scaled.protein}
            carbs={scaled.carbs}
            fat={scaled.fat}
          />
        )}

        {expanded && <FullLabel servingLabel={servingLabel} calories={calories} />}

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          style={{
            alignSelf: 'flex-start', minHeight: 'var(--v2-touch-target-min)',
            padding: '0 var(--v2-space-3)', border: 0, background: 'transparent',
            color: expanded ? 'var(--v2-text-secondary)' : 'var(--v2-accent-primary)',
            fontSize: 'var(--v2-text-sm)', fontWeight: 'var(--v2-weight-semibold)',
            fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
          }}
        >
          {expanded ? 'Hide full label' : 'Show full label'}
        </button>
      </div>
    </Card>
  )
}

function MacroSummary({
  calories, protein, carbs, fat,
}: {
  calories: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
}) {
  const cells: Array<{ label: string; value: string; accent?: boolean }> = [
    { label: 'Cal', value: calories !== null ? String(calories) : DASH, accent: true },
    { label: 'Protein', value: fmt(protein, 'g', 1) },
    { label: 'Carbs', value: fmt(carbs, 'g', 1) },
    { label: 'Fat', value: fmt(fat, 'g', 1) },
  ]
  return (
    <div
      style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: 'var(--v2-space-2)',
      }}
    >
      {cells.map((c) => (
        <div
          key={c.label}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
            padding: 'var(--v2-space-2)', borderRadius: 'var(--v2-radius-sm)',
            background: 'var(--v2-bg-surface)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)',
              textTransform: 'uppercase', letterSpacing: 'var(--v2-tracking-wide)',
              fontWeight: 'var(--v2-weight-semibold)',
            }}
          >
            {c.label}
          </span>
          <span
            style={{
              fontSize: 'var(--v2-text-lg)', fontWeight: 'var(--v2-weight-bold)',
              color: c.accent ? 'var(--v2-accent-primary)' : 'var(--v2-text-primary)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {c.value}
          </span>
        </div>
      ))}
    </div>
  )
}

interface FactRowSpec {
  label: ReactNode
  pct?: string
  indent?: boolean
}

function FullLabel({
  servingLabel, calories,
}: {
  servingLabel: string
  calories: number | null
}) {
  const { scaled } = useFoodDetail()
  const rows: FactRowSpec[] = [
    { label: <><b>Total Fat</b> {fmt(scaled.fat, 'g', 1)}</>, pct: pctDV(scaled.fat, DV.fat) },
    { label: <>Saturated Fat {fmt(scaled.satFat, 'g', 1)}</>, pct: pctDV(scaled.satFat, DV.satFat), indent: true },
  ]
  if (scaled.transFat !== null) rows.push({ label: <>Trans Fat {fmt(scaled.transFat, 'g', 2)}</>, indent: true })
  rows.push({ label: <><b>Sodium</b> {fmt(scaled.sodium, 'mg', 0)}</>, pct: pctDV(scaled.sodium, DV.sodium) })
  rows.push({ label: <><b>Total Carbohydrate</b> {fmt(scaled.carbs, 'g', 1)}</>, pct: pctDV(scaled.carbs, DV.carbs) })
  rows.push({ label: <>Dietary Fiber {fmt(scaled.fiber, 'g', 1)}</>, pct: pctDV(scaled.fiber, DV.fiber), indent: true })
  if (scaled.sugar !== null) rows.push({ label: <>Total Sugars {fmt(scaled.sugar, 'g', 1)}</>, indent: true })
  rows.push({ label: <><b>Protein</b> {fmt(scaled.protein, 'g', 1)}</>, pct: pctDV(scaled.protein, DV.protein) })

  const micros: FactRowSpec[] = []
  if (scaled.vitaminD !== null) micros.push({ label: <>Vitamin D {fmt(scaled.vitaminD, 'mcg', 1)}</>, pct: pctDV(scaled.vitaminD, DV.vitaminD) })
  if (scaled.calcium !== null) micros.push({ label: <>Calcium {fmt(scaled.calcium, 'mg', 0)}</>, pct: pctDV(scaled.calcium, DV.calcium) })
  if (scaled.iron !== null) micros.push({ label: <>Iron {fmt(scaled.iron, 'mg', 1)}</>, pct: pctDV(scaled.iron, DV.iron) })
  if (scaled.potassium !== null) micros.push({ label: <>Potassium {fmt(scaled.potassium, 'mg', 0)}</>, pct: pctDV(scaled.potassium, DV.potassium) })
  if (scaled.vitaminC !== null) micros.push({ label: <>Vitamin C {fmt(scaled.vitaminC, 'mg', 1)}</>, pct: pctDV(scaled.vitaminC, DV.vitaminC) })

  return (
    <div
      style={{
        background: 'var(--v2-bg-surface)', border: '1px solid var(--v2-border)',
        borderRadius: 'var(--v2-radius-md)', padding: 'var(--v2-space-4)',
        color: 'var(--v2-text-primary)', fontSize: 'var(--v2-text-sm)',
      }}
    >
      <div
        style={{
          fontSize: 'var(--v2-text-xl)', fontWeight: 'var(--v2-weight-bold)',
          letterSpacing: 'var(--v2-tracking-tight)',
          borderBottom: '6px solid var(--v2-text-primary)',
          paddingBottom: 'var(--v2-space-1)', marginBottom: 'var(--v2-space-2)',
        }}
      >
        Nutrition Facts
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
        <span style={{ color: 'var(--v2-text-secondary)' }}>Serving size</span>
        <span style={{ fontWeight: 'var(--v2-weight-semibold)', fontVariantNumeric: 'tabular-nums' }}>
          {servingLabel}
        </span>
      </div>

      <div style={{ borderTop: '1px solid var(--v2-border)', margin: 'var(--v2-space-1) 0' }} />
      <div style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-secondary)', marginBottom: 2 }}>
        Amount per serving
      </div>

      <div
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          borderBottom: '3px solid var(--v2-text-primary)',
          paddingBottom: 'var(--v2-space-1)', marginBottom: 'var(--v2-space-2)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span style={{ fontSize: 'var(--v2-text-lg)', fontWeight: 'var(--v2-weight-bold)' }}>
          Calories
        </span>
        <span style={{ fontSize: 'var(--v2-text-2xl)', fontWeight: 'var(--v2-weight-bold)' }}>
          {calories !== null ? calories : DASH}
        </span>
      </div>

      <div
        style={{
          textAlign: 'right', fontSize: 'var(--v2-text-xs)',
          color: 'var(--v2-text-secondary)', marginBottom: 'var(--v2-space-1)',
        }}
      >
        % Daily Value*
      </div>

      {rows.map((r, i) => <FactRow key={`m-${i}`} spec={r} />)}
      <div style={{ borderTop: '3px solid var(--v2-text-primary)', margin: 'var(--v2-space-1) 0' }} />
      {micros.map((r, i) => <FactRow key={`u-${i}`} spec={r} />)}

      <p
        style={{
          fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-secondary)',
          margin: 'var(--v2-space-3) 0 0', lineHeight: 'var(--v2-leading-relaxed)',
        }}
      >
        * The % Daily Value tells you how much a nutrient in a serving
        of food contributes to a daily diet. 2,000 calories a day is
        used for general nutrition advice.
      </p>
    </div>
  )
}

function FactRow({ spec }: { spec: FactRowSpec }) {
  return (
    <div
      style={{
        display: 'flex', justifyContent: 'space-between',
        borderBottom: '1px solid var(--v2-border-subtle)',
        padding: '4px 0', paddingLeft: spec.indent ? 'var(--v2-space-4)' : 0,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span>{spec.label}</span>
      <span style={{ fontWeight: 'var(--v2-weight-semibold)' }}>{spec.pct ?? ''}</span>
    </div>
  )
}
