'use client'

/**
 * Intelligence Dashboard
 *
 * Aggregates all 5 intelligence engines in one view.
 * Self-fetches from each /api/intelligence/* endpoint.
 */

import { useEffect, useState } from 'react'
import { Download, ChevronRight, Sparkles, Activity, Flame, Dumbbell, Heart, FileText, Compass } from 'lucide-react'

interface CycleIntel {
  currentPhase: string
  phaseConfidence: string
  cycleDay: number | null
  ovulation: { detected: boolean; estimatedDay: string | null; confidenceWindow: number; signals: Array<{ type: string; description: string }> }
  nextPeriod: { estimatedDay: string | null; confidenceWindow: number; confidence: string }
  fertileWindow: { isCurrentlyFertile: boolean }
  flags: Array<{ type: string; message: string; severity: string }>
  signalSummary: string
}

interface NutritionIntel {
  dailyCalories: number
  protein: number
  fat: number
  carbs: number
  tdeeEstimate: number
  weeklyAdjustment: number
  confidence: string
  explanation: string
}

interface ExerciseIntel {
  ceilings: Array<{ intensity: string; maxSafeMinutes: number | null; flareRate: number; sampleSize: number }>
  positionProgression: { currentLevel: string; progressionMessage: string; readyToProgress: boolean }
  weeklyCapacity: { estimatedMinutes: number; currentUsage: number; remaining: number }
  overallRecommendation: string
}

interface VitalsIntel {
  latestOrthostatic: { hrDelta: number; classification: string; meetsPOTSThreshold: boolean } | null
  thirtyDayTrend: { avgDelta: number | null; deltaDirection: string; meetsPOTSCount: number; totalTests: number }
  todayOutlier: { isOutlier: boolean; deviatingMetrics: string[]; severity: string } | null
  recommendations: string[]
}

type IntelStatus = 'good' | 'warn' | 'neutral'

// Card tint tokens. No reds, no saturated pinks. Warn uses a muted cream-amber,
// critical never uses red as a bg per §7.
const STATUS_TINT: Record<IntelStatus, { bg: string; border: string; accent: string }> = {
  good:    { bg: 'var(--accent-sage-muted)', border: 'rgba(107, 144, 128, 0.28)', accent: 'var(--accent-sage)' },
  warn:    { bg: 'rgba(212, 160, 160, 0.10)', border: 'rgba(212, 160, 160, 0.32)', accent: '#B07878' },
  neutral: { bg: 'var(--bg-card)',            border: 'var(--border-light)',       accent: 'var(--text-secondary)' },
}

/**
 * Strip rendered em-dashes. The Cycle API sometimes returns " -- " inside
 * flag.message; per project rule we replace with ". " so it renders as two
 * sentences instead of an em dash.
 */
function softenCopy(input: string): string {
  if (!input) return input
  // Collapse " -- " and "--" used as dashes to a period + space.
  return input
    .replace(/\s+--\s+/g, '. ')
    .replace(/\s+—\s+/g, '. ')
    .replace(/—/g, ',')
}

/**
 * Turn internal confidence strings (HIGH / MODERATE / LOW) or any uppercase
 * severity labels into gentle sentence case.
 */
function toSentence(input?: string): string {
  if (!input) return ''
  const s = input.replace(/_/g, ' ').trim()
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

/**
 * Map raw confidence labels to a patient-friendly phrase.
 */
function confidenceLabel(raw?: string): string | null {
  if (!raw) return null
  const v = raw.toLowerCase()
  if (v === 'high') return 'High confidence'
  if (v === 'moderate' || v === 'medium') return 'Moderate confidence'
  if (v === 'low') return 'Early signal'
  if (v === 'insufficient' || v === 'unknown' || v === 'stable') return null
  return toSentence(raw)
}

/**
 * Map the Levine-protocol progression level (e.g., "recumbent") to a
 * patient-friendly phrase per §6.
 */
function positionPhrase(level?: string): string {
  if (!level) return 'Gentle movement'
  const v = level.toLowerCase()
  if (v === 'recumbent') return 'Gentle movement'
  if (v === 'semi_recumbent' || v === 'semi-recumbent' || v === 'semirecumbent') return 'Paced activity'
  if (v === 'upright') return 'Upright activity'
  return toSentence(level)
}

/**
 * Patient-friendly phrasing for orthostatic trend direction.
 */
function trendPhrase(direction?: string): string {
  if (!direction) return ''
  const v = direction.toLowerCase()
  if (v === 'insufficient' || v === 'unknown') return 'Needs more data'
  if (v === 'worsening') return 'Drifting higher'
  if (v === 'improving') return 'Settling'
  if (v === 'stable') return 'Steady'
  return toSentence(direction)
}

// ─────────────────────────────────────────────────────────────────
// IntelCard
// ─────────────────────────────────────────────────────────────────

interface CardProps {
  title: string
  eyebrow?: string
  confidence?: string
  value?: React.ReactNode
  status?: IntelStatus
  body?: string
  icon?: React.ReactNode
  rows?: Array<{ label: string; value: string; color?: string }>
  children?: React.ReactNode
}

function IntelCard({ title, eyebrow, confidence, value, status = 'neutral', body, icon, rows, children }: CardProps) {
  const tint = STATUS_TINT[status]
  return (
    <div
      className="rounded-2xl"
      style={{
        background: tint.bg,
        border: `1px solid ${tint.border}`,
        padding: 'var(--space-5) var(--space-5)',
        boxShadow: 'var(--shadow-sm)',
        transition: `box-shadow var(--duration-fast) var(--ease-standard)`,
      }}
    >
      <div className="flex items-start gap-3" style={{ marginBottom: 'var(--space-2)' }}>
        {icon && (
          <span
            aria-hidden="true"
            className="flex items-center justify-center shrink-0"
            style={{
              width: 28,
              height: 28,
              borderRadius: 10,
              background: 'rgba(255, 255, 255, 0.55)',
              color: tint.accent,
            }}
          >
            {icon}
          </span>
        )}
        <div className="flex-1 min-w-0">
          {eyebrow && (
            <p
              className="font-semibold uppercase"
              style={{
                fontSize: 11,
                color: tint.accent,
                letterSpacing: '0.08em',
                margin: 0,
              }}
            >
              {eyebrow}
            </p>
          )}
          <h3
            className="font-semibold"
            style={{
              fontSize: 17,
              color: 'var(--text-primary)',
              lineHeight: 1.25,
              margin: '2px 0 0 0',
            }}
          >
            {title}
          </h3>
        </div>
      </div>

      {value && (
        <p
          className="tabular font-bold leading-none"
          style={{
            color: 'var(--text-primary)',
            fontSize: 30,
            letterSpacing: '-0.02em',
            margin: 'var(--space-3) 0 var(--space-2) 0',
          }}
        >
          {value}
        </p>
      )}

      {body && (
        <p
          className="leading-relaxed"
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            margin: 0,
          }}
        >
          {body}
        </p>
      )}

      {confidence && (
        <p
          className="mt-2"
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            margin: 'var(--space-2) 0 0 0',
          }}
        >
          {confidence}
        </p>
      )}

      {children}

      {rows && rows.length > 0 && (
        <div
          className="flex flex-col"
          style={{
            gap: 'var(--space-2)',
            marginTop: 'var(--space-4)',
            paddingTop: 'var(--space-3)',
            borderTop: `1px solid ${tint.border}`,
          }}
        >
          {rows.map((r, i) => (
            <div key={i} className="flex items-start justify-between gap-3" style={{ fontSize: 12.5 }}>
              <span
                className="shrink-0"
                style={{ color: 'var(--text-muted)', minWidth: 88 }}
              >
                {r.label}
              </span>
              <span
                className="tabular text-right"
                style={{ color: r.color ?? 'var(--text-primary)', fontWeight: 500 }}
              >
                {r.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Slow-pulse skeleton per §11 (1.5s cycle, not default animate-pulse).
function IntelCardSkeleton() {
  return (
    <div
      className="rounded-2xl"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        padding: 'var(--space-5)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-3)' }}>
        <div className="skeleton" style={{ height: 14, borderRadius: 4, width: 120 }} />
        <div className="skeleton" style={{ height: 14, borderRadius: 999, width: 64 }} />
      </div>
      <div className="skeleton" style={{ height: 28, borderRadius: 6, width: 140, marginBottom: 'var(--space-3)' }} />
      <div className="skeleton" style={{ height: 12, borderRadius: 4, width: '80%', marginBottom: 'var(--space-2)' }} />
      <div className="skeleton" style={{ height: 12, borderRadius: 4, width: '60%' }} />
    </div>
  )
}

// Small sage progress ring for weekly exercise capacity.
// Oura principle: show progress without shaming low scores.
function ProgressRing({ value, target }: { value: number; target: number }) {
  const pct = Math.max(0, Math.min(1, target > 0 ? value / target : 0))
  const r = 22
  const c = 2 * Math.PI * r
  const offset = c * (1 - pct)
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 56 56"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        stroke="rgba(107, 144, 128, 0.18)"
        strokeWidth="4"
      />
      <circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        stroke="var(--accent-sage)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 28 28)"
        style={{ transition: 'stroke-dashoffset var(--duration-slow) var(--ease-standard)' }}
      />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────
// Main dashboard
// ─────────────────────────────────────────────────────────────────

export function IntelligenceDashboard() {
  const [cycle, setCycle] = useState<CycleIntel | null>(null)
  const [nutrition, setNutrition] = useState<NutritionIntel | null>(null)
  const [exercise, setExercise] = useState<ExerciseIntel | null>(null)
  const [vitals, setVitals] = useState<VitalsIntel | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloadingType, setDownloadingType] = useState<string | null>(null)

  useEffect(() => {
    async function loadAll() {
      const [c, n, e, v] = await Promise.all([
        fetch('/api/intelligence/cycle').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/intelligence/nutrition?goal=maintain').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/intelligence/exercise').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/intelligence/vitals').then(r => r.ok ? r.json() : null).catch(() => null),
      ])
      setCycle(c)
      setNutrition(n)
      setExercise(e)
      setVitals(v)
      setLoading(false)
    }
    loadAll()
  }, [])

  const hasAny = cycle || nutrition || exercise || vitals

  return (
    <div
      className="route-desktop-split"
      style={{
        paddingTop: 'var(--space-3)',
        paddingBottom: 'var(--space-16)',
        paddingLeft: 'var(--space-4)',
        paddingRight: 'var(--space-4)',
        maxWidth: 680,
        margin: '0 auto',
      }}
    >
      {/* Primary column — intelligence cards */}
      <div className="flex flex-col" style={{ gap: 'var(--space-3)' }}>
        <header className="route-hero" style={{ padding: 0, marginBottom: 'var(--space-2)' }}>
          <div className="flex items-center" style={{ gap: 'var(--space-2)' }}>
            <Sparkles size={20} strokeWidth={2} style={{ color: 'var(--accent-sage)' }} aria-hidden="true" />
            <h1 className="page-title">Intelligence</h1>
          </div>
          <p
            className="route-hero__subtitle"
            style={{
              margin: 'var(--space-1) 0 0 0',
            }}
          >
            What the AI knows about your health right now.
          </p>
        </header>

        {loading && (
          <>
            <IntelCardSkeleton />
            <IntelCardSkeleton />
            <IntelCardSkeleton />
            <IntelCardSkeleton />
          </>
        )}

        {!loading && (
          <>
            {/* Cycle Intelligence */}
            {cycle && (
              <IntelCard
                eyebrow={`${toSentence(cycle.currentPhase.replace(/_/g, ' '))} phase`}
                title={cycle.cycleDay ? `Day ${cycle.cycleDay}` : 'Cycle status'}
                status={cycle.fertileWindow.isCurrentlyFertile ? 'warn' : 'good'}
                icon={<Heart size={16} strokeWidth={2} />}
                body={softenCopy(cycle.signalSummary)}
                confidence={confidenceLabel(cycle.phaseConfidence) ?? undefined}
                rows={[
                  ...(cycle.nextPeriod.estimatedDay ? [{
                    label: 'Next period',
                    value: `${cycle.nextPeriod.estimatedDay} (\u00B1${cycle.nextPeriod.confidenceWindow}d)`,
                  }] : []),
                  ...(cycle.ovulation.detected && cycle.ovulation.estimatedDay ? [{
                    label: 'Ovulation',
                    value: cycle.ovulation.estimatedDay,
                    color: 'var(--accent-sage)',
                  }] : []),
                  ...cycle.flags.map(f => ({
                    label: toSentence(f.type.replace(/_/g, ' ')),
                    value: softenCopy(f.message),
                    color: f.severity === 'concern'
                      ? '#B07878'
                      : f.severity === 'attention'
                      ? 'var(--text-primary)'
                      : 'var(--text-secondary)',
                  })),
                ]}
              />
            )}

            {/* Adaptive Nutrition */}
            {nutrition && (
              <IntelCard
                eyebrow="Daily target"
                title={`${nutrition.dailyCalories} kcal`}
                value={undefined}
                status="neutral"
                icon={<Flame size={16} strokeWidth={2} />}
                body={softenCopy(nutrition.explanation)}
                confidence={confidenceLabel(nutrition.confidence) ?? undefined}
                rows={[
                  { label: 'Protein', value: `${nutrition.protein}g` },
                  { label: 'Fat', value: `${nutrition.fat}g` },
                  { label: 'Carbs', value: `${nutrition.carbs}g` },
                  { label: 'TDEE estimate', value: `${nutrition.tdeeEstimate} kcal`, color: 'var(--text-muted)' },
                  ...(nutrition.weeklyAdjustment !== 0 ? [{
                    label: 'Weekly adjustment',
                    value: `${nutrition.weeklyAdjustment > 0 ? '+' : ''}${nutrition.weeklyAdjustment} cal/day`,
                    color: nutrition.weeklyAdjustment > 0 ? 'var(--accent-sage)' : '#B07878',
                  }] : []),
                ]}
              />
            )}

            {/* Exercise Intelligence */}
            {exercise && exercise.weeklyCapacity.estimatedMinutes > 0 && (
              <IntelCard
                eyebrow="Exercise capacity"
                title={positionPhrase(exercise.positionProgression.currentLevel)}
                status={exercise.weeklyCapacity.remaining > 0 ? 'neutral' : 'warn'}
                icon={<Dumbbell size={16} strokeWidth={2} />}
                body={softenCopy(exercise.overallRecommendation)}
                rows={exercise.ceilings
                  .filter(c => c.sampleSize > 0)
                  .map(c => ({
                    label: toSentence(c.intensity),
                    value: c.maxSafeMinutes ? `${c.maxSafeMinutes}min safe (${c.flareRate}% flare)` : 'Not enough data yet',
                    color: c.flareRate >= 40 ? '#B07878' : c.flareRate >= 20 ? 'var(--text-primary)' : 'var(--accent-sage)',
                  }))}
              >
                <div
                  className="flex items-center gap-4 mt-3"
                  style={{ marginTop: 'var(--space-3)' }}
                >
                  <ProgressRing
                    value={exercise.weeklyCapacity.currentUsage}
                    target={exercise.weeklyCapacity.estimatedMinutes}
                  />
                  <div className="flex-1">
                    <p
                      className="tabular font-bold leading-none"
                      style={{
                        color: 'var(--text-primary)',
                        fontSize: 22,
                        letterSpacing: '-0.01em',
                        margin: 0,
                      }}
                    >
                      <span>{exercise.weeklyCapacity.currentUsage}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 15, fontWeight: 500 }}>
                        {' of '}
                        {exercise.weeklyCapacity.estimatedMinutes}
                      </span>
                    </p>
                    <p
                      style={{
                        fontSize: 12.5,
                        color: 'var(--text-secondary)',
                        margin: '4px 0 0 0',
                      }}
                    >
                      target minutes this week
                    </p>
                  </div>
                </div>
              </IntelCard>
            )}

            {/* Vitals Intelligence */}
            {vitals && (
              <IntelCard
                eyebrow="Orthostatic vitals"
                title={vitals.latestOrthostatic ? `+${vitals.latestOrthostatic.hrDelta} bpm` : 'Needs more data'}
                status={
                  vitals.thirtyDayTrend.deltaDirection === 'worsening' ? 'warn' :
                  vitals.thirtyDayTrend.deltaDirection === 'improving' ? 'good' :
                  vitals.todayOutlier?.isOutlier ? 'warn' : 'neutral'
                }
                icon={<Activity size={16} strokeWidth={2} />}
                body={vitals.latestOrthostatic?.classification ? softenCopy(vitals.latestOrthostatic.classification) : undefined}
                confidence={trendPhrase(vitals.thirtyDayTrend.deltaDirection) || undefined}
                rows={[
                  ...(vitals.thirtyDayTrend.avgDelta !== null ? [{
                    label: '30-day avg delta',
                    value: `${vitals.thirtyDayTrend.avgDelta} bpm`,
                  }] : []),
                  ...(vitals.thirtyDayTrend.totalTests > 0 ? [{
                    label: 'POTS threshold',
                    value: `${vitals.thirtyDayTrend.meetsPOTSCount} of ${vitals.thirtyDayTrend.totalTests} tests`,
                    color: vitals.thirtyDayTrend.meetsPOTSCount > vitals.thirtyDayTrend.totalTests / 2 ? '#B07878' : 'var(--text-primary)',
                  }] : []),
                  ...(vitals.todayOutlier?.isOutlier ? [{
                    label: 'Today',
                    value: vitals.todayOutlier.deviatingMetrics.join(', '),
                    color: 'var(--text-primary)',
                  }] : []),
                  ...splitRecommendations(vitals.recommendations).slice(0, 2).map(r => ({
                    label: 'Next step',
                    value: r,
                    color: 'var(--text-secondary)',
                  })),
                ]}
              />
            )}

            {/* Empty state — no intel available at all */}
            {!hasAny && (
              <div className="empty-state">
                <Compass className="empty-state__icon" size={56} strokeWidth={1.5} aria-hidden="true" />
                <p className="empty-state__title">Your intelligence is warming up.</p>
                <p className="empty-state__hint">
                  Keep logging daily. Patterns and predictions surface here as the signal builds.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Secondary column — reports + deeper analysis. Stacks below on mobile. */}
      {!loading && (
        <aside className="flex flex-col" style={{ gap: 'var(--space-3)' }}>
          <ConditionReports
            downloadingType={downloadingType}
            onDownload={async type => {
              setDownloadingType(type)
              try {
                const res = await fetch(`/api/reports/condition?type=${type}&days=90`)
                if (!res.ok) return
                const data = await res.json()
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `lanaehealth-${type}-report-${new Date().toISOString().slice(0, 10)}.json`
                a.click()
                URL.revokeObjectURL(url)
              } catch {
                /* silent */
              } finally {
                setDownloadingType(null)
              }
            }}
          />

          <DeeperAnalysis />
        </aside>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Condition Reports section
// ─────────────────────────────────────────────────────────────────

const CONDITIONS: Array<{ type: string; label: string; doctor: string }> = [
  { type: 'endometriosis', label: 'Endometriosis', doctor: 'For OB/GYN or Reproductive Endocrinologist' },
  { type: 'pots', label: 'POTS / Dysautonomia', doctor: 'For Cardiologist or Autonomic Specialist' },
  { type: 'ibs', label: 'IBS / Digestive', doctor: 'For Gastroenterologist' },
]

function ConditionReports({
  downloadingType,
  onDownload,
}: {
  downloadingType: string | null
  onDownload: (type: string) => void
}) {
  return (
    <section
      className="rounded-2xl"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        padding: 'var(--space-5)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <header style={{ marginBottom: 'var(--space-3)' }}>
        <div className="flex items-center gap-2">
          <FileText size={16} strokeWidth={2} style={{ color: 'var(--text-secondary)' }} aria-hidden="true" />
          <h2
            className="font-semibold uppercase"
            style={{
              fontSize: 11,
              color: 'var(--text-primary)',
              letterSpacing: '0.08em',
              margin: 0,
            }}
          >
            Condition reports
          </h2>
        </div>
        <p
          style={{
            fontSize: 12.5,
            color: 'var(--text-muted)',
            margin: '6px 0 0 0',
            lineHeight: 1.5,
          }}
        >
          Download clinical summaries formatted for the specialist you&rsquo;re seeing.
        </p>
      </header>

      <div className="flex flex-col" style={{ gap: 'var(--space-2)' }}>
        {CONDITIONS.map(c => {
          const isDownloading = downloadingType === c.type
          return (
            <button
              key={c.type}
              type="button"
              onClick={() => !isDownloading && onDownload(c.type)}
              disabled={isDownloading}
              aria-label={`Download ${c.label} condition report (${c.doctor})`}
              className="press-feedback condition-row"
              style={{
                position: 'relative',
                overflow: 'hidden',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid transparent',
                borderRadius: 12,
                padding: 'var(--space-3) var(--space-4)',
                textAlign: 'left',
                cursor: isDownloading ? 'progress' : 'pointer',
                opacity: isDownloading ? 0.8 : 1,
                transition: 'transform var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard), background var(--duration-fast) var(--ease-standard)',
              }}
              onMouseEnter={e => {
                if (isDownloading) return
                e.currentTarget.style.borderColor = 'rgba(107, 144, 128, 0.28)'
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = 'var(--shadow-md)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'transparent'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              {isDownloading && (
                <span
                  aria-hidden="true"
                  className="shimmer-bar"
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1 }}
                />
              )}
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium" style={{ fontSize: 14, margin: 0 }}>{c.label}</p>
                  <p
                    style={{
                      fontSize: 12,
                      color: 'var(--text-muted)',
                      margin: '2px 0 0 0',
                    }}
                  >
                    {c.doctor}
                  </p>
                </div>
                <Download
                  size={18}
                  strokeWidth={2}
                  style={{
                    color: 'var(--accent-sage)',
                    flexShrink: 0,
                    transition: 'transform var(--duration-fast) var(--ease-standard)',
                  }}
                  aria-hidden="true"
                />
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────
// Deeper Analysis section
// ─────────────────────────────────────────────────────────────────

const DEEPER_LINKS: Array<{ href: string; label: string; sub: string }> = [
  {
    href: '/doctor',
    label: 'Doctor Mode',
    sub: 'Visit prep packet, clinical summary, and PDF export.',
  },
  {
    href: '/patterns',
    label: 'Patterns',
    sub: 'Charts and correlations across the last 90 days.',
  },
  {
    href: '/chat',
    label: 'AI Research',
    sub: 'Ask questions about your health data with citations.',
  },
]

function DeeperAnalysis() {
  return (
    <section
      className="rounded-2xl"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        padding: 'var(--space-5)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <header style={{ marginBottom: 'var(--space-3)' }}>
        <div className="flex items-center gap-2">
          <Compass size={16} strokeWidth={2} style={{ color: 'var(--text-secondary)' }} aria-hidden="true" />
          <h2
            className="font-semibold uppercase"
            style={{
              fontSize: 11,
              color: 'var(--text-primary)',
              letterSpacing: '0.08em',
              margin: 0,
            }}
          >
            Deeper analysis
          </h2>
        </div>
        <p
          style={{
            fontSize: 12.5,
            color: 'var(--text-muted)',
            margin: '6px 0 0 0',
            lineHeight: 1.5,
          }}
        >
          Follow any thread into the view built for it.
        </p>
      </header>

      <div className="flex flex-col" style={{ gap: 'var(--space-2)' }}>
        {DEEPER_LINKS.map(link => (
          <a
            key={link.href}
            href={link.href}
            aria-label={`${link.label}: ${link.sub}`}
            className="press-feedback deeper-row"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-3)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid transparent',
              borderRadius: 12,
              padding: 'var(--space-3) var(--space-4)',
              textDecoration: 'none',
              transition: 'transform var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(107, 144, 128, 0.28)'
              e.currentTarget.style.transform = 'translateY(-1px)'
              e.currentTarget.style.boxShadow = 'var(--shadow-md)'
              const chev = e.currentTarget.querySelector<SVGElement>('.deeper-chev')
              if (chev) chev.style.transform = 'translateX(2px)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'transparent'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
              const chev = e.currentTarget.querySelector<SVGElement>('.deeper-chev')
              if (chev) chev.style.transform = 'translateX(0)'
            }}
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium" style={{ fontSize: 14, margin: 0 }}>{link.label}</p>
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  margin: '2px 0 0 0',
                  lineHeight: 1.45,
                }}
              >
                {link.sub}
              </p>
            </div>
            <ChevronRight
              size={18}
              strokeWidth={2}
              className="deeper-chev"
              style={{
                flexShrink: 0,
                color: 'var(--accent-sage)',
                transition: 'transform var(--duration-fast) var(--ease-standard)',
              }}
              aria-hidden="true"
            />
          </a>
        ))}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────
// Copy helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Split long run-on recommendation sentences (e.g. the orthostatic "at least 3 times per week for trend analysis")
 * into shorter phrases for the "Next step" row.
 */
function splitRecommendations(input: string[]): string[] {
  if (!input || input.length === 0) return []
  return input.map(softenCopy).map(s => {
    // Specific rewrites for known orthostatic wording.
    if (/orthostatic\s+vitals/i.test(s) && /(3|three)\s+times\s+per\s+week/i.test(s)) {
      return 'Log supine then standing heart rate a few times a week. A trend appears after three entries.'
    }
    return s
  })
}
