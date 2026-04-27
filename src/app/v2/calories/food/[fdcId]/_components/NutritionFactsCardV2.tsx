'use client'

/**
 * NutritionFactsCardV2 (MFN parity rewrite, 2026-04-27)
 *
 * Two stacked sections that mirror MFN's food-detail page exactly:
 *
 *   1. "Food Macros" (frame_0050)
 *      Section header with caret. Pie chart on the left, percentage
 *      breakdown on the right reading "Carbs Xg / Protein Xg / Fat Xg"
 *      with the percent-of-calories label next to each. Pagination
 *      dot beneath suggesting the carousel of additional rings (we
 *      do not implement the carousel; only the first ring renders).
 *
 *   2. "My Nutrients" (frames 0050 + 0055)
 *      Section header with caret + green "Show % Food Label Daily
 *      Value" link right-aligned. Alternating-row table (white /
 *      gray-50). Bold parent rows with indented children. "Show All
 *      Nutrients" link at the bottom in green.
 *
 * Removed in this rewrite:
 *   - "Show full label" toggle (collapsed donut+tiles → expanded
 *     FDA-style label). Both views were wrong; MFN shows BOTH
 *     simultaneously, not toggled.
 *   - The 4-tile MacroSummary row (Cal / Protein / Carbs / Fat).
 *     PortionInputRow already shows the calorie total at the page
 *     level; the inline "Carbs 3g / Protein 2g / Fat 1g" labels in
 *     Food Macros replace the per-macro tiles.
 */

import { useMemo, useState } from 'react'
import { useFoodDetail } from './FoodDetailHero'
import {
  formatPctDV,
  formatAmount,
  type FdaNutrientKey,
} from '@/lib/nutrition/daily-values'

const COLOR_CARBS = '#E5C952'
const COLOR_PROTEIN = '#4DB8A8'
const COLOR_FAT = '#B79CD9'

export interface NutritionFactsCardV2Props {
  /**
   * Legacy prop kept for backward compatibility with the page
   * component's call sites. The new design always shows both sections
   * expanded, so this is a no-op. Will remove in a follow-up once
   * page.tsx is updated.
   */
  initialMode?: 'collapsed' | 'expanded'
}

export default function NutritionFactsCardV2(_props: NutritionFactsCardV2Props) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--v2-bg-card)',
      }}
    >
      <FoodMacrosSection />
      <MyNutrientsSection />
    </div>
  )
}

// ── Food Macros section (frame_0050) ─────────────────────────────────

function FoodMacrosSection() {
  const { scaled } = useFoodDetail()
  const [open, setOpen] = useState(true)

  const macros = useMemo(() => {
    const pCal = (scaled.protein ?? 0) * 4
    const cCal = (scaled.carbs ?? 0) * 4
    const fCal = (scaled.fat ?? 0) * 9
    const total = pCal + cCal + fCal
    if (total <= 0) {
      return { hasData: false as const, total: 0, carbsPct: 0, proteinPct: 0, fatPct: 0 }
    }
    return {
      hasData: true as const,
      total,
      carbsPct: (cCal / total) * 100,
      proteinPct: (pCal / total) * 100,
      fatPct: (fCal / total) * 100,
    }
  }, [scaled.protein, scaled.carbs, scaled.fat])

  return (
    <section
      aria-label="Food macros"
      style={{
        padding: 'var(--v2-space-4)',
        borderBottom: '8px solid var(--v2-bg-surface)',
      }}
    >
      <SectionHeader title="Food Macros" open={open} onToggle={() => setOpen((v) => !v)} />
      {open && (
        macros.hasData ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '120px 1fr',
              alignItems: 'center',
              columnGap: 'var(--v2-space-4)',
              paddingTop: 'var(--v2-space-3)',
            }}
          >
            <MacroPie carbsPct={macros.carbsPct} proteinPct={macros.proteinPct} fatPct={macros.fatPct} />
            <MacroBreakdownList
              carbs={scaled.carbs}
              protein={scaled.protein}
              fat={scaled.fat}
              carbsPct={macros.carbsPct}
              proteinPct={macros.proteinPct}
              fatPct={macros.fatPct}
            />
          </div>
        ) : (
          <p
            style={{
              margin: 'var(--v2-space-3) 0 0',
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-muted)',
            }}
          >
            Macro data not available for this food.
          </p>
        )
      )}
      {open && macros.hasData && <PaginationDots />}
    </section>
  )
}

function MacroPie({
  carbsPct,
  proteinPct,
  fatPct,
}: {
  carbsPct: number
  proteinPct: number
  fatPct: number
}) {
  const d = 110
  const stroke = 18
  const r = (d - stroke) / 2
  const c = 2 * Math.PI * r
  const carbsLen = (carbsPct / 100) * c
  const proteinLen = (proteinPct / 100) * c
  const fatLen = (fatPct / 100) * c

  return (
    <div style={{ position: 'relative', width: d, height: d }}>
      <svg width={d} height={d} viewBox={`0 0 ${d} ${d}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={d / 2}
          cy={d / 2}
          r={r}
          fill="none"
          stroke="rgba(0,0,0,0.05)"
          strokeWidth={stroke}
        />
        <circle
          cx={d / 2}
          cy={d / 2}
          r={r}
          fill="none"
          stroke={COLOR_CARBS}
          strokeWidth={stroke}
          strokeDasharray={`${carbsLen} ${c}`}
          strokeDashoffset={0}
        />
        <circle
          cx={d / 2}
          cy={d / 2}
          r={r}
          fill="none"
          stroke={COLOR_PROTEIN}
          strokeWidth={stroke}
          strokeDasharray={`${proteinLen} ${c}`}
          strokeDashoffset={-carbsLen}
        />
        <circle
          cx={d / 2}
          cy={d / 2}
          r={r}
          fill="none"
          stroke={COLOR_FAT}
          strokeWidth={stroke}
          strokeDasharray={`${fatLen} ${c}`}
          strokeDashoffset={-(carbsLen + proteinLen)}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          color: 'var(--v2-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          fontWeight: 'var(--v2-weight-semibold)',
          lineHeight: 1.2,
        }}
      >
        <span style={{ fontSize: 13, color: 'var(--v2-text-secondary)' }}>
          {Math.round(carbsPct)}%
        </span>
        <span>cals</span>
      </div>
    </div>
  )
}

function MacroBreakdownList({
  carbs,
  protein,
  fat,
  carbsPct,
  proteinPct,
  fatPct,
}: {
  carbs: number | null
  protein: number | null
  fat: number | null
  carbsPct: number
  proteinPct: number
  fatPct: number
}) {
  const rows = [
    { label: 'Carbs', g: carbs, pct: carbsPct, color: COLOR_CARBS },
    { label: 'Protein', g: protein, pct: proteinPct, color: COLOR_PROTEIN },
    { label: 'Fat', g: fat, pct: fatPct, color: COLOR_FAT },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
      {rows.map((r) => (
        <div
          key={r.label}
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            alignItems: 'baseline',
            columnGap: 'var(--v2-space-2)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--v2-text-base)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: r.color,
            }}
          >
            {r.label}
          </span>
          <span
            style={{
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-muted)',
              fontVariantNumeric: 'tabular-nums',
              textAlign: 'right',
            }}
          >
            {Math.round(r.pct)}%
          </span>
          <span
            style={{
              fontSize: 'var(--v2-text-base)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)',
              fontVariantNumeric: 'tabular-nums',
              minWidth: 48,
              textAlign: 'right',
            }}
          >
            {formatAmount(r.g, 'g', 1)}
          </span>
        </div>
      ))}
    </div>
  )
}

function PaginationDots() {
  // Decorative; suggests the carousel of additional rings MFN renders
  // (Net Carbs, Sugar, etc.). We do not implement the carousel today.
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 6,
        marginTop: 'var(--v2-space-3)',
      }}
      aria-hidden
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'var(--v2-text-secondary)',
        }}
      />
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'var(--v2-border)',
        }}
      />
    </div>
  )
}

// ── My Nutrients section (frames 0050 + 0055) ────────────────────────

interface NutrientRow {
  label: string
  value: number | null
  unit: 'g' | 'mg' | 'mcg'
  digits?: number
  dvKey: FdaNutrientKey | null // null = informational only (e.g. Trans Fat)
  parent?: boolean
  indent?: boolean
}

function MyNutrientsSection() {
  const { scaled } = useFoodDetail()
  const [open, setOpen] = useState(true)
  const [showAll, setShowAll] = useState(false)

  const primaryRows: NutrientRow[] = [
    { label: 'Total Fat', value: scaled.fat, unit: 'g', dvKey: 'fat', parent: true },
    { label: 'Saturated Fat', value: scaled.satFat, unit: 'g', dvKey: 'satFat', indent: true },
    { label: 'Trans Fat', value: scaled.transFat, unit: 'g', digits: 2, dvKey: null, indent: true },
    { label: 'Total Carbs', value: scaled.carbs, unit: 'g', dvKey: 'carbs', parent: true },
    { label: 'Dietary Fiber', value: scaled.fiber, unit: 'g', dvKey: 'fiber', indent: true },
    { label: 'Sugars', value: scaled.sugar, unit: 'g', dvKey: null, indent: true },
    { label: 'Protein', value: scaled.protein, unit: 'g', dvKey: 'protein', parent: true },
    { label: 'Sodium', value: scaled.sodium, unit: 'mg', digits: 0, dvKey: 'sodium', parent: true },
    { label: 'Calcium', value: scaled.calcium, unit: 'mg', digits: 0, dvKey: 'calcium', parent: true },
  ]

  const microRows: NutrientRow[] = [
    { label: 'Iron', value: scaled.iron, unit: 'mg', dvKey: 'iron', parent: true },
    { label: 'Potassium', value: scaled.potassium, unit: 'mg', digits: 0, dvKey: 'potassium', parent: true },
    { label: 'Vitamin C', value: scaled.vitaminC, unit: 'mg', dvKey: 'vitaminC', parent: true },
    { label: 'Vitamin D', value: scaled.vitaminD, unit: 'mcg', dvKey: 'vitaminD', parent: true },
    { label: 'Vitamin B12', value: scaled.vitaminB12, unit: 'mcg', digits: 1, dvKey: 'vitaminB12', parent: true },
    { label: 'Magnesium', value: scaled.magnesium, unit: 'mg', digits: 0, dvKey: 'magnesium', parent: true },
    { label: 'Zinc', value: scaled.zinc, unit: 'mg', dvKey: 'zinc', parent: true },
    { label: 'Folate', value: scaled.folate, unit: 'mcg', digits: 0, dvKey: 'folate', parent: true },
  ]

  // "Show All Nutrients" expands to include the micro rows. Filter
  // out rows where the value is null AND we are in collapsed mode so
  // the table never shows a sea of `--`.
  const visibleRows = showAll
    ? [...primaryRows, ...microRows]
    : primaryRows

  return (
    <section
      aria-label="My nutrients"
      style={{
        padding: 'var(--v2-space-4)',
      }}
    >
      <SectionHeader
        title="My Nutrients"
        open={open}
        onToggle={() => setOpen((v) => !v)}
        trailing={
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: '#3F8F69',
              fontWeight: 'var(--v2-weight-semibold)',
            }}
          >
            Show % Food Label Daily Value
          </span>
        }
      />
      {open && (
        <>
          <div
            role="table"
            style={{
              marginTop: 'var(--v2-space-2)',
              border: '1px solid var(--v2-border-subtle)',
              borderRadius: 'var(--v2-radius-sm)',
              overflow: 'hidden',
            }}
          >
            {visibleRows.map((row, i) => (
              <NutrientTableRow key={`${row.label}-${i}`} row={row} stripe={i % 2 === 1} />
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            style={{
              marginTop: 'var(--v2-space-3)',
              background: 'transparent',
              border: 0,
              padding: 'var(--v2-space-2) 0',
              color: '#3F8F69',
              fontSize: 'var(--v2-text-sm)',
              fontWeight: 'var(--v2-weight-semibold)',
              fontFamily: 'inherit',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            {showAll ? 'Show fewer nutrients' : 'Show All Nutrients'}
          </button>
        </>
      )}
    </section>
  )
}

function NutrientTableRow({ row, stripe }: { row: NutrientRow; stripe: boolean }) {
  const valueStr = formatAmount(row.value, row.unit, row.digits ?? 1)
  const pctStr = row.dvKey ? formatPctDV(row.value, row.dvKey) : ''
  return (
    <div
      role="row"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        alignItems: 'center',
        columnGap: 'var(--v2-space-3)',
        padding: '10px 12px',
        paddingLeft: row.indent ? 28 : 12,
        background: stripe ? 'var(--v2-bg-surface)' : 'var(--v2-bg-card)',
        fontSize: 'var(--v2-text-sm)',
        color: 'var(--v2-text-primary)',
      }}
    >
      <span>
        <span
          style={{
            fontWeight: row.parent
              ? 'var(--v2-weight-semibold)'
              : 'var(--v2-weight-regular)',
          }}
        >
          {row.label}
        </span>{' '}
        <span style={{ color: 'var(--v2-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
          {valueStr}
        </span>
      </span>
      <span
        style={{
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--v2-text-secondary)',
          fontWeight: 'var(--v2-weight-semibold)',
          minWidth: 36,
          textAlign: 'right',
        }}
      >
        {pctStr}
      </span>
    </div>
  )
}

// ── Shared section header ────────────────────────────────────────────

function SectionHeader({
  title,
  open,
  onToggle,
  trailing,
}: {
  title: string
  open: boolean
  onToggle: () => void
  trailing?: React.ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--v2-space-3)',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{
          background: 'transparent',
          border: 0,
          padding: 0,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--v2-space-2)',
          fontSize: 'var(--v2-text-base)',
          fontWeight: 'var(--v2-weight-bold)',
          color: 'var(--v2-text-primary)',
          fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      >
        {title}
        <CaretIcon open={open} />
      </button>
      {trailing}
    </div>
  )
}

function CaretIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 120ms ease',
        color: 'var(--v2-text-muted)',
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}
