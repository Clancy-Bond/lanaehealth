'use client'

import { useState, useMemo, useRef } from 'react'
import { Plus, X, ChevronDown, Camera } from 'lucide-react'
import type { LabResult, LabFlag } from '@/lib/types'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { PhotoLabScanner } from '@/components/labs/PhotoLabScanner'

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
        const data = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(data.error || 'Failed to save lab result')
      }

      const data = await res.json()
      onSubmit(data.result)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="card p-4 mb-4"
      style={{ border: '1.5px solid var(--accent-sage)', boxShadow: 'var(--shadow-md)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Add Lab Result
        </h3>
        <button
          onClick={onClose}
          className="touch-target p-1 rounded-lg"
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
            className="w-full rounded-xl px-3 py-2 text-sm"
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
            Test Name
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
            placeholder="e.g. Ferritin, Hemoglobin, TSH..."
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
            className="w-full rounded-xl px-3 py-2 text-sm"
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
            Ref. Range Low
          </label>
          <input
            type="number"
            step="any"
            value={refLow}
            onChange={(e) => setRefLow(e.target.value)}
            placeholder="e.g. 12"
            className="w-full rounded-xl px-3 py-2 text-sm"
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
            Ref. Range High
          </label>
          <input
            type="number"
            step="any"
            value={refHigh}
            onChange={(e) => setRefHigh(e.target.value)}
            placeholder="e.g. 150"
            className="w-full rounded-xl px-3 py-2 text-sm"
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
        <p className="text-xs mt-2" style={{ color: 'var(--pain-severe)' }}>
          {error}
        </p>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full mt-3 py-2.5 rounded-xl text-sm font-semibold transition-opacity"
        style={{
          background: 'var(--accent-sage)',
          color: 'var(--text-inverse)',
          opacity: submitting ? 0.6 : 1,
        }}
      >
        {submitting ? 'Saving...' : 'Save Lab Result'}
      </button>
    </div>
  )
}

function flagColor(flag: LabFlag | null): string {
  switch (flag) {
    case 'low':
      return '#3B82F6'    // blue-500
    case 'high':
      return '#F97316'    // orange-500
    case 'critical':
      return '#EF4444'    // red-500
    case 'normal':
    default:
      return 'var(--accent-sage)'
  }
}

function flagLabel(flag: LabFlag | null): string {
  switch (flag) {
    case 'low':
      return 'Low'
    case 'high':
      return 'High'
    case 'critical':
      return 'Critical'
    case 'normal':
    default:
      return 'Normal'
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
  const trendData = useMemo(() => {
    return allResults
      .filter((r) => r.test_name === testName && r.value !== null)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => ({
        date: formatShortDate(r.date),
        value: r.value as number,
        refLow: r.reference_range_low,
        refHigh: r.reference_range_high,
      }))
  }, [testName, allResults])

  if (trendData.length < 2) return null

  // Use the first item's reference range for the reference lines
  const refLow = trendData[0]?.refLow ?? undefined
  const refHigh = trendData[0]?.refHigh ?? undefined

  return (
    <div className="mt-3 rounded-xl p-3" style={{ background: 'var(--bg-elevated)' }}>
      <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
        {testName} trend
      </p>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
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
          {refLow !== undefined && refLow !== null && (
            <ReferenceLine
              y={refLow}
              stroke="var(--text-muted)"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
          )}
          {refHigh !== undefined && refHigh !== null && (
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
      </ResponsiveContainer>
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

  // Group by date, most recent first
  const groupedByDate = useMemo(() => {
    const groups: Record<string, LabResult[]> = {}
    for (const r of results) {
      if (!groups[r.date]) groups[r.date] = []
      groups[r.date].push(r)
    }
    // Sort dates descending
    const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a))
    return sortedDates.map((date) => ({
      date,
      results: groups[date],
    }))
  }, [results])

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
          <div className="text-center py-12">
            <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
              No lab results yet
            </p>
            <p className="text-sm mt-1 mb-4" style={{ color: 'var(--text-muted)' }}>
              Add results manually or scan a photo of your lab report
            </p>
            <div className="flex gap-2 justify-center flex-wrap">
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
                style={{
                  background: 'var(--accent-sage-muted)',
                  color: 'var(--accent-sage)',
                  border: '1px solid rgba(107, 144, 128, 0.2)',
                }}
              >
                <Plus size={16} strokeWidth={2.5} />
                Add Result
              </button>
              <button
                onClick={() => setShowScanner(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
                style={{
                  background: 'var(--accent-sage)',
                  color: 'var(--text-inverse)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <Camera size={16} strokeWidth={2.5} />
                Scan Photo
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Add Result / Scan Photo buttons and forms */}
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
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-shadow"
            style={{
              background: 'var(--accent-sage-muted)',
              color: 'var(--accent-sage)',
              border: '1px solid rgba(107, 144, 128, 0.2)',
            }}
          >
            <Plus size={16} strokeWidth={2.5} />
            Add Result
          </button>
          <button
            onClick={() => setShowScanner(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-shadow"
            style={{
              background: 'var(--accent-sage)',
              color: 'var(--text-inverse)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <Camera size={16} strokeWidth={2.5} />
            Scan Photo
          </button>
          <a
            href="/api/export?format=csv"
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-shadow"
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

      {groupedByDate.map(({ date, results: dateResults }) => (
        <div key={date}>
          {/* Date header */}
          <div className="flex items-center gap-2 mb-3">
            <div
              className="h-px flex-1"
              style={{ background: 'var(--border-light)' }}
            />
            <span
              className="text-xs font-semibold uppercase tracking-wide px-2"
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

              return (
                <div key={lab.id}>
                  {idx > 0 && (
                    <div className="mx-4" style={{ borderTop: '1px solid var(--border-light)' }} />
                  )}
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      {/* Test name */}
                      <span
                        className="text-sm font-medium flex-1 min-w-0 truncate"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {lab.test_name}
                      </span>

                      {/* Value + unit + flag indicator */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className="text-sm font-semibold"
                          style={{
                            color: lab.flag === 'high' || lab.flag === 'critical'
                              ? flagColor(lab.flag)
                              : lab.flag === 'low'
                              ? flagColor(lab.flag)
                              : 'var(--text-primary)',
                          }}
                        >
                          {lab.value !== null ? lab.value : '--'}
                          {lab.unit && (
                            <span className="text-xs font-normal ml-1" style={{ color: 'var(--text-muted)' }}>
                              {lab.unit}
                            </span>
                          )}
                        </span>
                        {lab.flag && lab.flag !== 'normal' ? (
                          <span
                            className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold shrink-0"
                            style={{
                              background: flagColor(lab.flag) + '1A',
                              color: flagColor(lab.flag),
                              border: `1px solid ${flagColor(lab.flag)}40`,
                            }}
                          >
                            {flagLabel(lab.flag)}
                          </span>
                        ) : (
                          <span
                            className="inline-block w-2 h-2 rounded-full shrink-0"
                            style={{ background: flagColor(lab.flag) }}
                            title={flagLabel(lab.flag)}
                          />
                        )}
                      </div>
                    </div>

                    {/* Reference range */}
                    {(lab.reference_range_low !== null || lab.reference_range_high !== null) && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        Ref: {lab.reference_range_low ?? '--'} - {lab.reference_range_high ?? '--'} {lab.unit || ''}
                      </p>
                    )}

                    {/* Trend button */}
                    {showTrendButton && (
                      <button
                        onClick={() => toggleTrend(lab.test_name)}
                        className="touch-target mt-1 text-xs font-medium rounded-md px-2 py-1"
                        style={{
                          color: 'var(--accent-sage)',
                          background: isTrendOpen ? 'var(--accent-sage-muted)' : 'transparent',
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
