'use client'

/*
 * WeightLossCalculator
 *
 * Live-updating weight-loss plan calculator. Inputs at the top, results
 * recompute on every keystroke / slider drag via the pure
 * calculateWeightPlan() function. On Save, the same payload is POSTed
 * to /api/calories/weight-plan, which writes both the full plan and a
 * synced nutrition_goals row so the dashboard ring follows.
 *
 * Methodology and source citations live at
 * docs/research/weight-loss-calculation-methodology.md.
 *
 * Voice rules (NC-style): short, kind, explanatory. No em-dashes.
 */
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useReducedMotion } from 'motion/react'
import {
  Banner,
  Button,
  Card,
  SegmentedControl,
} from '@/v2/components/primitives'
import {
  calculateWeightPlan,
  type ActivityLevel,
  type Sex,
  type WeightPlanInputs,
} from '@/lib/calories/weight-plan'

const ACTIVITY_OPTIONS: Array<{ value: ActivityLevel; label: string; sub: string }> = [
  { value: 'sedentary', label: 'Sedentary', sub: 'Desk job, little exercise' },
  { value: 'light', label: 'Light', sub: '1 to 3 sessions a week' },
  { value: 'moderate', label: 'Moderate', sub: '3 to 5 sessions a week' },
  { value: 'active', label: 'Active', sub: '6 to 7 sessions a week' },
  { value: 'very_active', label: 'Very active', sub: 'Daily plus physical job' },
]

const SEX_OPTIONS: Array<{ value: Sex; label: string }> = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
]

const RATE_STEPS = [0.25, 0.5, 0.75, 1.0] as const

const KG_TO_LB = 2.20462
const CM_TO_IN = 0.393701
const lbToKg = (lb: number) => lb / KG_TO_LB
const kgToLb = (kg: number) => kg * KG_TO_LB
const inToCm = (i: number) => i / CM_TO_IN
const cmToIn = (c: number) => c * CM_TO_IN

export interface WeightLossCalculatorProps {
  initial: Partial<WeightPlanInputs>
  /** Conditions auto-detected from active_problems / diagnoses; the
   *  user can still toggle. */
  detectedConditions: { POTS: boolean; migraine: boolean; cycle: boolean }
}

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--v2-text-lg)',
  fontWeight: 'var(--v2-weight-semibold)',
  color: 'var(--v2-text-primary)',
  letterSpacing: 'var(--v2-tracking-tight)',
}
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--v2-text-xs)',
  fontWeight: 'var(--v2-weight-semibold)',
  color: 'var(--v2-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: 'var(--v2-tracking-wide)',
  marginBottom: 'var(--v2-space-1)',
}
const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 44,
  padding: '0 var(--v2-space-3)',
  borderRadius: 'var(--v2-radius-md)',
  border: '1px solid var(--v2-border-subtle)',
  background: 'var(--v2-bg-elevated)',
  color: 'var(--v2-text-primary)',
  fontSize: 'var(--v2-text-base)',
  fontFamily: 'inherit',
  fontVariantNumeric: 'tabular-nums',
}
const subtleStyle: React.CSSProperties = {
  margin: 'var(--v2-space-2) 0 0',
  fontSize: 'var(--v2-text-xs)',
  color: 'var(--v2-text-muted)',
  lineHeight: 'var(--v2-leading-relaxed)',
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

export default function WeightLossCalculator({
  initial,
  detectedConditions,
}: WeightLossCalculatorProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [unit, setUnit] = useState<'lb' | 'kg'>('lb')
  const [heightUnit, setHeightUnit] = useState<'in' | 'cm'>('in')

  const [currentWeightKg, setCurrentWeightKg] = useState<number>(initial.currentWeightKg ?? 67.3)
  const [heightCm, setHeightCm] = useState<number>(initial.heightCm ?? 170)
  const [ageYears, setAgeYears] = useState<number>(initial.ageYears ?? 24)
  const [sex, setSex] = useState<Sex>(initial.sex ?? 'female')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(initial.activityLevel ?? 'moderate')
  const [goalWeightKg, setGoalWeightKg] = useState<number>(initial.goalWeightKg ?? Math.max(45, (initial.currentWeightKg ?? 67.3) - 5))
  const [weeklyRateKg, setWeeklyRateKg] = useState<number>(initial.weeklyRateKg ?? 0.5)
  const [conditions, setConditions] = useState(detectedConditions)

  const plan = useMemo(
    () =>
      calculateWeightPlan({
        currentWeightKg,
        heightCm,
        ageYears,
        sex,
        activityLevel,
        goalWeightKg,
        weeklyRateKg,
        conditions,
      }),
    [currentWeightKg, heightCm, ageYears, sex, activityLevel, goalWeightKg, weeklyRateKg, conditions],
  )

  const onSave = () => {
    setError(null)
    const payload: WeightPlanInputs = {
      currentWeightKg,
      heightCm,
      ageYears,
      sex,
      activityLevel,
      goalWeightKg,
      weeklyRateKg,
      conditions,
    }
    startTransition(async () => {
      try {
        const res = await fetch('/api/calories/weight-plan', {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          setError("That didn't go through. Want to try again?")
          return
        }
        setSavedAt(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }))
        router.refresh()
      } catch {
        setError("That didn't go through. Want to try again?")
      }
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-5)' }}>
      {savedAt && (
        <Banner
          intent="success"
          title={`Saved at ${savedAt}`}
          body="Your dashboard ring will use this target starting now."
        />
      )}

      {/* ── Inputs ─────────────────────────────────────── */}
      <Card padding="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-4)' }}>
          <h2 style={sectionTitleStyle}>About you</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--v2-space-3)' }}>
            <div>
              <label htmlFor="wlc-current" style={labelStyle}>
                Current weight
              </label>
              <div style={{ display: 'flex', gap: 'var(--v2-space-2)' }}>
                <input
                  id="wlc-current"
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  value={unit === 'lb' ? round1(kgToLb(currentWeightKg)) : round1(currentWeightKg)}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    if (!Number.isFinite(n)) return
                    setCurrentWeightKg(unit === 'lb' ? lbToKg(n) : n)
                  }}
                  style={inputStyle}
                  aria-label={`Current weight in ${unit}`}
                />
                <SegmentedControl
                  segments={[
                    { value: 'lb', label: 'lb' },
                    { value: 'kg', label: 'kg' },
                  ]}
                  value={unit}
                  onChange={(v) => setUnit(v as 'lb' | 'kg')}
                />
              </div>
            </div>

            <div>
              <label htmlFor="wlc-goal" style={labelStyle}>
                Goal weight
              </label>
              <input
                id="wlc-goal"
                type="number"
                step="0.1"
                inputMode="decimal"
                value={unit === 'lb' ? round1(kgToLb(goalWeightKg)) : round1(goalWeightKg)}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  if (!Number.isFinite(n)) return
                  setGoalWeightKg(unit === 'lb' ? lbToKg(n) : n)
                }}
                style={inputStyle}
                aria-label={`Goal weight in ${unit}`}
              />
            </div>

            <div>
              <label htmlFor="wlc-height" style={labelStyle}>
                Height
              </label>
              <div style={{ display: 'flex', gap: 'var(--v2-space-2)' }}>
                <input
                  id="wlc-height"
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  value={heightUnit === 'in' ? round1(cmToIn(heightCm)) : round1(heightCm)}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    if (!Number.isFinite(n)) return
                    setHeightCm(heightUnit === 'in' ? inToCm(n) : n)
                  }}
                  style={inputStyle}
                  aria-label={`Height in ${heightUnit}`}
                />
                <SegmentedControl
                  segments={[
                    { value: 'in', label: 'in' },
                    { value: 'cm', label: 'cm' },
                  ]}
                  value={heightUnit}
                  onChange={(v) => setHeightUnit(v as 'in' | 'cm')}
                />
              </div>
            </div>

            <div>
              <label htmlFor="wlc-age" style={labelStyle}>
                Age
              </label>
              <input
                id="wlc-age"
                type="number"
                inputMode="numeric"
                min={10}
                max={120}
                value={ageYears}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  if (!Number.isFinite(n)) return
                  setAgeYears(Math.round(n))
                }}
                style={inputStyle}
                aria-label="Age in years"
              />
            </div>
          </div>

          <div>
            <span style={labelStyle}>Sex (for BMR formula)</span>
            <SegmentedControl
              segments={SEX_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              value={sex}
              onChange={(v) => setSex(v as Sex)}
              fullWidth
            />
            <p style={subtleStyle}>
              Used only by the Mifflin-St Jeor formula. If you'd rather not pick, leave it on Female; the math runs slightly more conservative.
            </p>
          </div>

          <div>
            <span style={labelStyle}>Activity level</span>
            <div
              role="radiogroup"
              aria-label="Activity level"
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}
            >
              {ACTIVITY_OPTIONS.map((o) => {
                const selected = activityLevel === o.value
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setActivityLevel(o.value)}
                    style={{
                      textAlign: 'left',
                      padding: 'var(--v2-space-3)',
                      borderRadius: 'var(--v2-radius-md)',
                      border: `1px solid ${selected ? 'var(--v2-accent-primary)' : 'var(--v2-border-subtle)'}`,
                      background: selected ? 'var(--v2-accent-primary-soft)' : 'var(--v2-bg-elevated)',
                      color: 'var(--v2-text-primary)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      minHeight: 'var(--v2-touch-target-min)',
                    }}
                  >
                    <div style={{ fontWeight: 'var(--v2-weight-semibold)', fontSize: 'var(--v2-text-sm)' }}>
                      {o.label}
                    </div>
                    <div style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)', marginTop: 2 }}>
                      {o.sub}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* ── Weekly rate ─────────────────────────────────── */}
      <Card padding="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
          <h2 style={sectionTitleStyle}>How fast?</h2>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 'var(--v2-text-2xl)', fontWeight: 'var(--v2-weight-bold)', color: 'var(--v2-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {round2(unit === 'lb' ? kgToLb(weeklyRateKg) : weeklyRateKg)} {unit}
            </span>
            <span style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-muted)' }}>per week</span>
          </div>
          <input
            type="range"
            min={0.25}
            max={1.0}
            step={0.05}
            value={weeklyRateKg}
            onChange={(e) => setWeeklyRateKg(Number(e.target.value))}
            aria-label="Weekly weight loss rate in kilograms"
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', gap: 'var(--v2-space-2)', flexWrap: 'wrap' }}>
            {RATE_STEPS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setWeeklyRateKg(r)}
                aria-pressed={weeklyRateKg === r}
                style={{
                  flex: 1,
                  minWidth: 64,
                  minHeight: 36,
                  borderRadius: 'var(--v2-radius-sm)',
                  border: `1px solid ${weeklyRateKg === r ? 'var(--v2-accent-primary)' : 'var(--v2-border-subtle)'}`,
                  background: weeklyRateKg === r ? 'var(--v2-accent-primary-soft)' : 'transparent',
                  color: 'var(--v2-text-primary)',
                  fontSize: 'var(--v2-text-sm)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {round2(unit === 'lb' ? kgToLb(r) : r)} {unit}
              </button>
            ))}
          </div>
          <p style={subtleStyle}>
            CDC and NIH recommend 0.5 to 1.0 kg per week (about 1 to 2 lb). Faster than that and you start losing muscle, not just fat. The slider stops at the safe ceiling on purpose.
          </p>
        </div>
      </Card>

      {/* ── Live results ────────────────────────────────── */}
      <Card padding="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-4)' }}>
          <h2 style={sectionTitleStyle}>Your plan</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--v2-space-3)' }}>
            <Stat label="Maintenance (TDEE)" value={`${plan.tdee.toLocaleString()} cal`} sub={`BMR ${plan.bmr.toLocaleString()} cal`} />
            <Stat
              label="Daily target"
              value={`${plan.targetCalories.toLocaleString()} cal`}
              sub={`-${plan.deficit.toLocaleString()} cal/day`}
              accent
            />
            <Stat
              label="Weeks to goal"
              value={plan.weeksToGoal > 0 ? `${plan.weeksToGoal} wk` : 'At goal'}
              sub={plan.weeksToGoal > 0 ? `Around ${formatDate(plan.targetDate)}` : 'Maintenance'}
            />
            <Stat
              label="Effective rate"
              value={`${round2(unit === 'lb' ? kgToLb(plan.effectiveWeeklyRateKg) : plan.effectiveWeeklyRateKg)} ${unit}/wk`}
              sub={
                Math.abs(plan.effectiveWeeklyRateKg - weeklyRateKg) > 0.001
                  ? 'Adjusted to stay safe'
                  : 'Matches your pick'
              }
            />
          </div>

          {/* Macro donut row */}
          <MacroBreakdown
            proteinG={plan.macros.proteinG}
            carbsG={plan.macros.carbsG}
            fatG={plan.macros.fatG}
            proteinPercent={plan.macros.proteinPercent}
            carbsPercent={plan.macros.carbsPercent}
            fatPercent={plan.macros.fatPercent}
          />

          {/* Meal split */}
          <div>
            <span style={labelStyle}>Suggested meal split</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--v2-space-2)' }}>
              {(
                [
                  ['Breakfast', plan.mealSplit.breakfast, '25%'],
                  ['Lunch', plan.mealSplit.lunch, '30%'],
                  ['Dinner', plan.mealSplit.dinner, '35%'],
                  ['Snacks', plan.mealSplit.snacks, '10%'],
                ] as const
              ).map(([name, kcal, pct]) => (
                <div
                  key={name}
                  style={{
                    padding: 'var(--v2-space-2)',
                    borderRadius: 'var(--v2-radius-sm)',
                    background: 'var(--v2-bg-elevated)',
                    border: '1px solid var(--v2-border-subtle)',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)', textTransform: 'uppercase', letterSpacing: 'var(--v2-tracking-wide)' }}>{name}</div>
                  <div style={{ fontSize: 'var(--v2-text-base)', fontWeight: 'var(--v2-weight-bold)', color: 'var(--v2-text-primary)', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{kcal}</div>
                  <div style={{ fontSize: 10, color: 'var(--v2-text-muted)' }}>{pct}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* ── Warnings ────────────────────────────────────── */}
      {plan.warnings.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
          {plan.warnings.map((w, i) => (
            <Banner key={i} intent="warning" title="Heads up" body={w} />
          ))}
        </div>
      )}

      {/* ── Refeed recommendation ──────────────────────── */}
      {plan.refeedRecommendation && (
        <Card variant="explanatory" padding="md">
          <h3 style={{ ...sectionTitleStyle, marginBottom: 'var(--v2-space-2)' }}>About diet breaks</h3>
          <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', lineHeight: 'var(--v2-leading-relaxed)' }}>
            {plan.refeedRecommendation}
          </p>
        </Card>
      )}

      {/* ── Condition-aware adjustments ─────────────────── */}
      {(plan.conditionAdjustments?.length ?? 0) > 0 && (
        <Card variant="explanatory" padding="md">
          <h3 style={{ ...sectionTitleStyle, marginBottom: 'var(--v2-space-2)' }}>Adjustments for your conditions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
            {plan.conditionAdjustments?.map((a, i) => (
              <div
                key={i}
                style={{
                  padding: 'var(--v2-space-3)',
                  borderRadius: 'var(--v2-radius-sm)',
                  background: 'rgba(255, 255, 255, 0.5)',
                  border: '1px solid var(--v2-surface-explanatory-border)',
                  fontSize: 'var(--v2-text-sm)',
                  lineHeight: 'var(--v2-leading-relaxed)',
                }}
              >
                {a}
              </div>
            ))}
          </div>
          <ConditionToggles
            value={conditions}
            onChange={setConditions}
            detected={detectedConditions}
          />
        </Card>
      )}

      {/* No conditions detected, but allow manual toggle */}
      {(plan.conditionAdjustments?.length ?? 0) === 0 && (
        <Card padding="md">
          <h3 style={{ ...sectionTitleStyle, marginBottom: 'var(--v2-space-3)' }}>Conditions to factor in</h3>
          <p style={subtleStyle}>
            Toggle any that apply. The plan will fold them in.
          </p>
          <ConditionToggles
            value={conditions}
            onChange={setConditions}
            detected={detectedConditions}
          />
        </Card>
      )}

      {error && (
        <Banner intent="warning" title="Couldn't save" body={error} />
      )}

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          background: 'linear-gradient(to top, var(--v2-bg-primary) 65%, transparent)',
          paddingTop: 'var(--v2-space-4)',
          paddingBottom: 'var(--v2-space-4)',
        }}
      >
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={pending}
          onClick={onSave}
          type="button"
          aria-label="Save plan"
        >
          {pending ? 'Saving...' : 'Save plan'}
        </Button>
      </div>
    </div>
  )
}

// ── Subcomponents ────────────────────────────────────────────────

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub: string
  accent?: boolean
}) {
  return (
    <div
      style={{
        padding: 'var(--v2-space-3)',
        borderRadius: 'var(--v2-radius-md)',
        background: accent ? 'var(--v2-accent-primary-soft)' : 'var(--v2-bg-elevated)',
        border: `1px solid ${accent ? 'var(--v2-accent-primary)' : 'var(--v2-border-subtle)'}`,
      }}
    >
      <div style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)', textTransform: 'uppercase', letterSpacing: 'var(--v2-tracking-wide)' }}>{label}</div>
      <div style={{ fontSize: 'var(--v2-text-xl)', fontWeight: 'var(--v2-weight-bold)', color: 'var(--v2-text-primary)', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)', marginTop: 2 }}>{sub}</div>
    </div>
  )
}

function MacroBreakdown({
  proteinG,
  carbsG,
  fatG,
  proteinPercent,
  carbsPercent,
  fatPercent,
}: {
  proteinG: number
  carbsG: number
  fatG: number
  proteinPercent: number
  carbsPercent: number
  fatPercent: number
}) {
  const reduce = useReducedMotion()
  const tiles = [
    { label: 'Protein', g: proteinG, pct: proteinPercent, color: '#4DB8A8' },
    { label: 'Carbs', g: carbsG, pct: carbsPercent, color: '#E5C952' },
    { label: 'Fat', g: fatG, pct: fatPercent, color: '#B79CD9' },
  ]
  return (
    <div>
      <span style={labelStyle}>Macros (daily)</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--v2-space-3)' }}>
        {tiles.map((t) => (
          <div key={t.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--v2-space-2)' }}>
            <Donut value={t.pct} color={t.color} centerValue={`${t.g}`} centerUnit="g" reduce={!!reduce} />
            <div style={{ fontSize: 'var(--v2-text-xs)', fontWeight: 'var(--v2-weight-semibold)', color: 'var(--v2-text-primary)', textTransform: 'uppercase', letterSpacing: 'var(--v2-tracking-wide)' }}>
              {t.label}
            </div>
            <div style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
              {t.pct}%
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Donut({
  value,
  color,
  centerValue,
  centerUnit,
  reduce,
}: {
  value: number // 0-100
  color: string
  centerValue: string
  centerUnit: string
  reduce: boolean
}) {
  const d = 72
  const stroke = 8
  const r = (d - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, value))
  const offset = c * (1 - pct / 100)

  return (
    <div style={{ position: 'relative', width: d, height: d }}>
      <svg width={d} height={d} viewBox={`0 0 ${d} ${d}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={d / 2} cy={d / 2} r={r} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={stroke} />
        <circle
          cx={d / 2}
          cy={d / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: reduce ? 'none' : 'stroke-dashoffset 600ms var(--v2-ease-emphasized)' }}
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
          lineHeight: 1,
        }}
      >
        <span style={{ fontSize: 'var(--v2-text-base)', fontWeight: 'var(--v2-weight-bold)', color: 'var(--v2-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
          {centerValue}
        </span>
        <span style={{ fontSize: 9, color: 'var(--v2-text-muted)', marginTop: 2 }}>{centerUnit}</span>
      </div>
    </div>
  )
}

function ConditionToggles({
  value,
  onChange,
  detected,
}: {
  value: { POTS: boolean; migraine: boolean; cycle: boolean }
  onChange: (v: { POTS: boolean; migraine: boolean; cycle: boolean }) => void
  detected: { POTS: boolean; migraine: boolean; cycle: boolean }
}) {
  const items: Array<{ key: keyof typeof value; label: string }> = [
    { key: 'POTS', label: 'POTS / orthostatic intolerance' },
    { key: 'migraine', label: 'Migraine' },
    { key: 'cycle', label: 'Heavy or painful periods' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)', marginTop: 'var(--v2-space-3)' }}>
      {items.map(({ key, label }) => {
        const checked = value[key]
        const auto = detected[key]
        return (
          <label
            key={key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--v2-space-3)',
              padding: 'var(--v2-space-2)',
              borderRadius: 'var(--v2-radius-sm)',
              cursor: 'pointer',
              minHeight: 'var(--v2-touch-target-min)',
            }}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
              aria-label={label}
            />
            <span style={{ fontSize: 'var(--v2-text-sm)' }}>
              {label}
              {auto && (
                <span style={{ color: 'var(--v2-text-muted)', fontSize: 'var(--v2-text-xs)', marginLeft: 6 }}>
                  (from your profile)
                </span>
              )}
            </span>
          </label>
        )
      })}
    </div>
  )
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
function round2(n: number): number {
  return Math.round(n * 100) / 100
}
