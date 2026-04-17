'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Plus, X, ChevronDown, Camera, Search, FlaskConical } from 'lucide-react'
import type { LabResult, LabFlag } from '@/lib/types'
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ReferenceArea } from 'recharts'
import { PhotoLabScanner } from '@/components/labs/PhotoLabScanner'
import { LabSparkline } from '@/components/records/LabSparkline'
import {
  computeDeltas,
  formatDelta,
  formatPercent,
  type DeltaWindow,
} from '@/lib/labs/deltas'
import { flagForValue, resolveRefRange } from '@/lib/labs/ranges'

// ── Common test name suggestions ────────────────────────────────────

const TEST_SUGGESTIONS = [
  'Ferritin', 'Iron', 'TIBC', 'Transferrin Saturation',
  'Hemoglobin', 'Hematocrit', 'RBC', 'WBC', 'Platelets', 'MCV', 'MCH', 'MCHC',
  'Vitamin D', 'Vitamin B12', 'Folate',
  'TSH', 'Free T4', 'Free T3',
  'hs-CRP', 'ESR', 'IL-6',
  'Total Cholesterol', 'LDL', 'HDL', 'Triglycerides',
  'Glucose', 'HbA1c', 'Insulin',
  'Creatinine', 'BUN', 'eGFR',
  'ALT', 'AST', 'ALP', 'Bilirubin',
  'PT', 'INR', 'aPTT', 'Fibrinogen',
]

const CATEGORY_OPTIONS = [
  'CBC', 'Iron Studies', 'Vitamins', 'Hormones', 'Lipids',
  'Inflammation', 'Metabolic', 'Coagulation', 'Other',
]

// ── Add Lab Result Form ─────────────────────────────────────────────

interface AddLabFormProps {
  onClose: () => void
  onSubmit: (result: LabResult) => void
}

function AddLabForm({ onClose, onSubmit }: AddLabFormProps) {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [testName, setTestName] = useState('')
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState('')
  const [refLow, setRefLow] = useState('')
  const [refHigh, setRefHigh] = useState('')
  const [category, setCategory] = useState('Other')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const testInputRef = useRef<HTMLInputElement>(null)

  const filteredSuggestions = TEST_SUGGESTIONS.filter(
    (s) => s.toLowerCase().includes(testName.toLowerCase()) && testName.length > 0
  )

  const handleSubmit = async () => {
    if (!date || !testName.trim()) {
      setError('Date and test name are required.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/labs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          test_name: testName.trim(),
          value: value ? parseFloat(value) : null,
          unit: unit.trim() || null,
          reference_range_low: refLow ? parseFloat(refLow) : null,
          reference_range_high: refHigh ? parseFloat(refHigh) : null,
          category,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Something broke on my end. Try again?' }))
        throw new Error(data.error || 'Something broke on my end. Try again?')
      }

      const data = await res.json()
      onSubmit(data.result)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something broke on my end. Try again?')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="card p-4 mb-4"
      style={{ border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-md)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Add lab result
        </h3>
        <button
          onClick={onClose}
          className="touch-target press-feedback p-1 rounded-lg"
          style={{ color: 'var(--text-muted)' }}
          aria-label="Close form"
        >
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Date */}
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="tabular w-full rounded-xl px-3 py-2 text-sm"
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        {/* Category */}
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Category
          </label>
          <div className="relative">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl px-3 py-2 text-sm appearance-none"
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                paddingRight: '32px',
              }}
            >
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--text-muted)' }}
            />
          </div>
        </div>

        {/* Test Name with suggestions */}
        <div className="col-span-2 relative">
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Test name
          </label>
          <input
            ref={testInputRef}
            type="text"
            value={testName}
            onChange={(e) => {
              setTestName(e.target.value)
              setShowSuggestions(true)
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder="e.g. Ferritin, Hemoglobin, TSH"
            className="w-full rounded-xl px-3 py-2 text-sm"
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          />
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div
              className="absolute z-20 w-full mt-1 max-h-32 overflow-y-auto rounded-xl"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              {filteredSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onMouseDown={() => {
                    setTestName(suggestion)
                    setShowSuggestions(false)
                  }}
                  className="w-full text-left px-3 py-2 text-sm"
                  style={{ color: 'var(--text-primary)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-elevated)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Value */}
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Value
          </label>
          <input
            type="number"
            step="any"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. 42"
            className="tabular w-full rounded-xl px-3 py-2 text-sm"
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        {/* Unit */}
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Unit
          </label>
          <input
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="e.g. ng/mL"
            className="w-full rounded-xl px-3 py-2 text-sm"
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        {/* Reference Range Low */}
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Ref. range low
          </label>
          <input
            type="number"
            step="any"
            value={refLow}
            onChange={(e) => setRefLow(e.target.value)}
            placeholder="e.g. 12"
            className="tabular w-full rounded-xl px-3 py-2 text-sm"
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        {/* Reference Range High */}
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Ref. range high
          </label>
          <input
            type="number"
            step="any"
            value={refHigh}
            onChange={(e) => setRefHigh(e.target.value)}
            placeholder="e.g. 150"
            className="tabular w-full rounded-xl px-3 py-2 text-sm"
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
          {error}
        </p>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="press-feedback w-full mt-3 py-2.5 rounded-xl text-sm font-semibold"
        style={{
          background: 'var(--accent-sage)',
          color: 'var(--text-inverse)',
          opacity: submitting ? 0.5 : 1,
          cursor: submitting ? 'not-allowed' : 'pointer',
          transition: `opacity var(--duration-fast) var(--ease-standard)`,
        }}
      >
        {submitting ? 'Saving' : 'Save lab result'}
      </button>
    </div>
  )
}

// ── Flag styling: soft tones, no saturated red ──────────────────────

interface FlagStyle {
  stripe: string
  chipBg: string
  chipFg: string
  label: string
}

function flagStyle(flag: LabFlag | null): FlagStyle | null {
  switch (flag) {
    case 'low':
      return {
        stripe: 'rgba(59, 130, 246, 0.45)',
        chipBg: 'rgba(59, 130, 246, 0.10)',
        chipFg: '#3B6FBF',
        label: 'Below range',
      }
    case 'high':
      return {
        stripe: 'rgba(217, 169, 78, 0.55)',
        chipBg: 'rgba(217, 169, 78, 0.14)',
        chipFg: '#9A7A2C',
        label: 'Above range',
      }
    case 'critical':
      return {
        stripe: 'rgba(212, 160, 160, 0.65)',
        chipBg: 'rgba(212, 160, 160, 0.18)',
        chipFg: '#8C5A5A',
        label: 'Watch closely',
      }
    case 'normal':
    default:
      return null
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface TrendChartProps {
  testName: string
  allResults: LabResult[]
}

function TrendChart({ testName, allResults }: TrendChartProps) {
  // Measure parent width after mount instead of using ResponsiveContainer,
  // which gets 0 width during SSR/hydration on Vercel and never re-renders.
  const chartRef = useRef<HTMLDivElement>(null)
  const [chartWidth, setChartWidth] = useState(0)

  useEffect(() => {
    const measure = () => {
      if (chartRef.current) {
        setChartWidth(chartRef.current.clientWidth)
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const trendData = useMemo(() => {
    return allResults
      .filter((r) => r.test_name === testName && r.value !== null)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => ({
        date: formatShortDate(r.date),
        value: r.value as number,
      }))
  }, [testName, allResults])

  // Resolve the reference range once using the most-recent entry for this
  // test name; falls back to canonical ranges when the row has none.
  const range = useMemo(() => {
    const rowsForTest = allResults
      .filter((r) => r.test_name === testName)
      .sort((a, b) => b.date.localeCompare(a.date))
    const latest = rowsForTest[0]
    if (!latest) return { low: null, high: null }
    const resolved = resolveRefRange(
      latest.test_name,
      latest.unit,
      latest.reference_range_low,
      latest.reference_range_high,
    )
    return { low: resolved.low, high: resolved.high }
  }, [testName, allResults])

  if (trendData.length < 2) return null

  const refLow = range.low
  const refHigh = range.high
  const hasBand = refLow !== null && refHigh !== null

  return (
    <div className="mt-3 rounded-xl p-3" style={{ background: 'var(--bg-elevated)' }}>
      <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
        {testName} trend
      </p>
      <div ref={chartRef} style={{ width: '100%', height: 120 }}>
        {chartWidth > 0 && (
          <LineChart
            width={chartWidth}
            height={120}
            data={trendData}
            margin={{ top: 4, right: 8, bottom: 0, left: -20 }}
          >
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            {hasBand && (
              <ReferenceArea
                y1={refLow as number}
                y2={refHigh as number}
                fill="rgba(107, 144, 128, 0.10)"
                fillOpacity={1}
                stroke="none"
                ifOverflow="extendDomain"
              />
            )}
            {refLow !== null && !hasBand && (
              <ReferenceLine
                y={refLow}
                stroke="var(--text-muted)"
                strokeDasharray="4 4"
                strokeWidth={1}
              />
            )}
            {refHigh !== null && !hasBand && (
              <ReferenceLine
                y={refHigh}
                stroke="var(--text-muted)"
                strokeDasharray="4 4"
                strokeWidth={1}
              />
            )}
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--accent-sage)"
              strokeWidth={2}
              dot={{ fill: 'var(--accent-sage)', r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        )}
      </div>
    </div>
  )
}

// ── Delta badges: current vs 30d / 90d / 1y rolling medians ─────────

function deltaBadgeStyle(delta: number | null): { bg: string; fg: string; border: string } {
  if (delta === null || delta === 0) {
    return {
      bg: 'var(--bg-elevated)',
      fg: 'var(--text-muted)',
      border: '1px solid var(--border-light)',
    }
  }
  if (delta > 0) {
    return {
      bg: 'rgba(217, 169, 78, 0.10)',
      fg: '#9A7A2C',
      border: '1px solid rgba(217, 169, 78, 0.22)',
    }
  }
  return {
    bg: 'rgba(59, 130, 246, 0.08)',
    fg: '#3B6FBF',
    border: '1px solid rgba(59, 130, 246, 0.18)',
  }
}

function DeltaBadge({ window: w, unit }: { window: DeltaWindow; unit: string | null }) {
  const style = deltaBadgeStyle(w.delta)
  const hasBaseline = w.median !== null
  const primary = hasBaseline ? formatDelta(w.delta) : 'no baseline'
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ background: style.bg, color: style.fg, border: style.border }}
      title={
        hasBaseline
          ? `Median over last ${w.days} days: ${w.median?.toFixed(2)}${unit ? ' ' + unit : ''} (n=${w.sampleSize})`
          : `No readings in the last ${w.days} days`
      }
    >
      <span className="tabular">{primary}</span>
      <span className="opacity-70">vs {w.label}</span>
      {hasBaseline && w.percent !== null && (
        <span className="opacity-60 tabular">({formatPercent(w.percent)})</span>
      )}
    </span>
  )
}

interface InlineTrendProps {
  testName: string
  allResults: LabResult[]
  unit: string | null
  currentDate: string
}

function InlineSparkRow({ testName, allResults, unit, currentDate }: InlineTrendProps) {
  // Only show sparkline and deltas for the most recent lab of each test,
  // so we do not repeat the same chart on every historical row.
  const series = useMemo(() => {
    return allResults
      .filter((r) => r.test_name === testName && r.value !== null)
      .map((r) => ({ date: r.date, value: r.value as number }))
  }, [allResults, testName])

  // Only render on the current (latest) row.
  const latestDate = useMemo(() => {
    if (series.length === 0) return null
    return series.reduce(
      (acc, p) => (acc > p.date ? acc : p.date),
      series[0].date,
    )
  }, [series])

  if (!latestDate || latestDate !== currentDate) return null
  if (series.length < 2) return null

  const latest = allResults
    .filter((r) => r.test_name === testName)
    .sort((a, b) => b.date.localeCompare(a.date))[0]
  const range = resolveRefRange(
    testName,
    latest?.unit ?? unit,
    latest?.reference_range_low ?? null,
    latest?.reference_range_high ?? null,
  )

  const deltas = computeDeltas(series)

  return (
    <div className="mt-2">
      <LabSparkline
        data={series}
        refLow={range.low}
        refHigh={range.high}
        height={30}
        ariaLabel={`${testName} sparkline, ${series.length} readings`}
      />
      {deltas && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {deltas.windows.map((w) => (
            <DeltaBadge key={w.label} window={w} unit={unit} />
          ))}
        </div>
      )}
    </div>
  )
}

interface LabsTabProps {
  results: LabResult[]
  onAdd?: (result: LabResult) => void
}

export function LabsTab({ results, onAdd }: LabsTabProps) {
  const [showForm, setShowForm] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [expandedTrends, setExpandedTrends] = useState<Set<string>>(() => {
    // Auto-expand Ferritin trend
    const initial = new Set<string>()
    if (results.some((r) => r.test_name === 'Ferritin')) {
      initial.add('Ferritin')
    }
    return initial
  })

  const handleAdd = (result: LabResult) => {
    if (onAdd) onAdd(result)
    setShowForm(false)
  }

  const handleScannedImport = (imported: LabResult[]) => {
    if (onAdd) {
      for (const r of imported) {
        onAdd(r)
      }
    }
  }

  // Categories that exist in the data (for filter chips)
  const availableCategories = useMemo(() => {
    const set = new Set<string>()
    for (const r of results) {
      if (r.category) set.add(r.category)
    }
    return Array.from(set).sort()
  }, [results])

  // Filtered list based on search + category
  const filteredResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    return results.filter((r) => {
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false
      if (!q) return true
      return (
        r.test_name.toLowerCase().includes(q) ||
        (r.category?.toLowerCase().includes(q) ?? false) ||
        (r.unit?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [results, query, categoryFilter])

  // Group by date, most recent first
  const groupedByDate = useMemo(() => {
    const groups: Record<string, LabResult[]> = {}
    for (const r of filteredResults) {
      if (!groups[r.date]) groups[r.date] = []
      groups[r.date].push(r)
    }
    // Sort dates descending
    const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a))
    return sortedDates.map((date) => ({
      date,
      results: groups[date],
    }))
  }, [filteredResults])

  // Tests that appear on multiple dates (eligible for trend)
  const trendEligible = useMemo(() => {
    const dateCounts: Record<string, Set<string>> = {}
    for (const r of results) {
      if (!dateCounts[r.test_name]) dateCounts[r.test_name] = new Set()
      dateCounts[r.test_name].add(r.date)
    }
    const eligible = new Set<string>()
    for (const [name, dates] of Object.entries(dateCounts)) {
      if (dates.size >= 2) eligible.add(name)
    }
    return eligible
  }, [results])

  const toggleTrend = (testName: string) => {
    setExpandedTrends((prev) => {
      const next = new Set(prev)
      if (next.has(testName)) {
        next.delete(testName)
      } else {
        next.add(testName)
      }
      return next
    })
  }

  // ── Empty state: no labs at all ──────────────────────────────────
  if (results.length === 0) {
    return (
      <div className="space-y-6">
        {showScanner ? (
          <PhotoLabScanner
            onClose={() => setShowScanner(false)}
            onImported={handleScannedImport}
          />
        ) : showForm ? (
          <AddLabForm onClose={() => setShowForm(false)} onSubmit={handleAdd} />
        ) : (
          <div className="empty-state">
            <FlaskConical
              className="empty-state__icon"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <p className="empty-state__title">No labs here yet</p>
            <p className="empty-state__hint">
              Import from myAH, upload a PDF, or add a single value manually.
            </p>
            <div className="flex gap-2 justify-center flex-wrap mt-2">
              <button
                onClick={() => setShowForm(true)}
                className="press-feedback flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
                style={{
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                <Plus size={16} strokeWidth={2} />
                Add result
              </button>
              <button
                onClick={() => setShowScanner(true)}
                className="press-feedback flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
                style={{
                  background: 'var(--accent-sage)',
                  color: 'var(--text-inverse)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <Camera size={16} strokeWidth={2.5} />
                Scan photo
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Action row: neutral Add, sage Scan (single primary), neutral Export */}
      {showScanner ? (
        <PhotoLabScanner
          onClose={() => setShowScanner(false)}
          onImported={handleScannedImport}
        />
      ) : showForm ? (
        <AddLabForm onClose={() => setShowForm(false)} onSubmit={handleAdd} />
      ) : (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowForm(true)}
            className="press-feedback flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
            style={{
              background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              transition: `background var(--duration-fast) var(--ease-standard)`,
            }}
          >
            <Plus size={16} strokeWidth={2} />
            Add result
          </button>
          <button
            onClick={() => setShowScanner(true)}
            className="press-feedback flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
            style={{
              background: 'var(--accent-sage)',
              color: 'var(--text-inverse)',
              boxShadow: 'var(--shadow-sm)',
              transition: `box-shadow var(--duration-fast) var(--ease-standard)`,
            }}
          >
            <Camera size={16} strokeWidth={2.5} />
            Scan photo
          </button>
          <a
            href="/api/export?format=csv"
            className="press-feedback flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium"
            style={{
              background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              textDecoration: 'none',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 10v3a1 1 0 001 1h10a1 1 0 001-1v-3" />
              <path d="M8 2v8" />
              <path d="M5 7l3 3 3-3" />
            </svg>
            Export
          </a>
        </div>
      )}

      {/* Search + category chips */}
      {!showForm && !showScanner && (
        <div className="space-y-3">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--text-muted)' }}
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your labs"
              aria-label="Search lab results"
              className="w-full rounded-xl pl-9 pr-3 py-2.5 text-sm"
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {availableCategories.length > 1 && (
            <div
              className="flex gap-2 overflow-x-auto hide-scrollbar pb-1"
              role="group"
              aria-label="Filter by category"
            >
              <button
                onClick={() => setCategoryFilter('all')}
                className="press-feedback rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap"
                style={{
                  background: categoryFilter === 'all' ? 'var(--accent-sage-muted)' : 'var(--bg-elevated)',
                  color: categoryFilter === 'all' ? 'var(--accent-sage)' : 'var(--text-secondary)',
                  border: categoryFilter === 'all' ? '1px solid rgba(107, 144, 128, 0.2)' : '1px solid transparent',
                  transition: `background var(--duration-fast) var(--ease-standard)`,
                }}
              >
                All
              </button>
              {availableCategories.map((cat) => {
                const isActive = categoryFilter === cat
                return (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className="press-feedback rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap"
                    style={{
                      background: isActive ? 'var(--accent-sage-muted)' : 'var(--bg-elevated)',
                      color: isActive ? 'var(--accent-sage)' : 'var(--text-secondary)',
                      border: isActive ? '1px solid rgba(107, 144, 128, 0.2)' : '1px solid transparent',
                      transition: `background var(--duration-fast) var(--ease-standard)`,
                    }}
                  >
                    {cat}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Filtered-but-empty state */}
      {!showForm && !showScanner && filteredResults.length === 0 && (
        <div className="empty-state">
          <Search className="empty-state__icon" strokeWidth={1.5} aria-hidden="true" />
          <p className="empty-state__title">Nothing matches your search</p>
          <p className="empty-state__hint">
            Try a different test name or clear the category filter.
          </p>
        </div>
      )}

      {/* Date-grouped lab cards */}
      {groupedByDate.map(({ date, results: dateResults }) => (
        <div key={date}>
          {/* Date header */}
          <div className="flex items-center gap-2 mb-3">
            <div
              className="h-px flex-1"
              style={{ background: 'var(--border-light)' }}
            />
            <span
              className="tabular text-xs font-semibold uppercase tracking-wide px-2"
              style={{ color: 'var(--text-muted)' }}
            >
              {formatDate(date)}
            </span>
            <div
              className="h-px flex-1"
              style={{ background: 'var(--border-light)' }}
            />
          </div>

          {/* Results for this date */}
          <div className="card overflow-hidden">
            {dateResults.map((lab, idx) => {
              const showTrendButton = trendEligible.has(lab.test_name)
              const isTrendOpen = expandedTrends.has(lab.test_name)
              // Prefer an explicit flag from the row; fall back to
              // deriving one from the resolved reference range so
              // rows without ref_low/high still flag correctly.
              const resolved = resolveRefRange(
                lab.test_name,
                lab.unit,
                lab.reference_range_low,
                lab.reference_range_high,
              )
              const derivedFlag = flagForValue(lab.value, resolved.low, resolved.high)
              const effective: LabFlag | 'low' | 'high' | 'normal' | null =
                lab.flag ?? derivedFlag
              const style = flagStyle(effective as LabFlag)
              const outOfRange = !!style

              return (
                <div key={lab.id}>
                  {idx > 0 && (
                    <div className="mx-4" style={{ borderTop: '1px solid var(--border-light)' }} />
                  )}
                  <div
                    className="px-4 py-3 relative"
                    style={
                      outOfRange
                        ? {
                            borderLeft: `2px solid ${style!.stripe}`,
                          }
                        : undefined
                    }
                  >
                    <div className="flex items-center justify-between gap-3">
                      {/* Test name */}
                      <span
                        className="text-sm font-medium flex-1 min-w-0 truncate"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {lab.test_name}
                      </span>

                      {/* Value + unit + flag chip */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className="tabular text-sm font-semibold"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {lab.value !== null ? lab.value : '-'}
                          {lab.unit && (
                            <span
                              className="text-xs font-normal ml-1"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              {lab.unit}
                            </span>
                          )}
                        </span>
                        {style ? (
                          <span
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0"
                            style={{
                              background: style.chipBg,
                              color: style.chipFg,
                            }}
                          >
                            {style.label}
                          </span>
                        ) : (
                          <span
                            className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: 'var(--text-muted)', opacity: 0.45 }}
                            aria-label="In range"
                            title="In range"
                          />
                        )}
                      </div>
                    </div>

                    {/* Reference range (with canonical-fallback badge) */}
                    {(resolved.low !== null || resolved.high !== null) && (
                      <p className="tabular text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        Ref {resolved.low ?? '-'} to {resolved.high ?? '-'} {lab.unit || ''}
                        {resolved.source === 'canonical' && (
                          <span
                            className="ml-1 opacity-70"
                            title="Row has no reference range; using canonical adult-female range."
                          >
                            (canonical)
                          </span>
                        )}
                      </p>
                    )}

                    {/* Inline sparkline + delta badges for the most recent
                        row of each multi-date test */}
                    <InlineSparkRow
                      testName={lab.test_name}
                      allResults={results}
                      unit={lab.unit}
                      currentDate={lab.date}
                    />

                    {/* Trend button */}
                    {showTrendButton && (
                      <button
                        onClick={() => toggleTrend(lab.test_name)}
                        className="touch-target press-feedback mt-1 text-xs font-medium rounded-md px-2 py-1"
                        style={{
                          color: 'var(--accent-sage)',
                          background: isTrendOpen ? 'var(--accent-sage-muted)' : 'transparent',
                          transition: `background var(--duration-fast) var(--ease-standard)`,
                        }}
                      >
                        {isTrendOpen ? 'Hide trend' : 'Show trend'}
                      </button>
                    )}

                    {/* Inline trend chart */}
                    {isTrendOpen && (
                      <TrendChart testName={lab.test_name} allResults={results} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
