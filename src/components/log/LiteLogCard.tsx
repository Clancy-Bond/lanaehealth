'use client'

/**
 * LiteLogCard (Wave 2e F2) - the 30-second Daylio-inspired lite log.
 *
 * Lives at the top of /log for low-energy days. Single card combining:
 *   1. 5-face mood row (reuses MoodCard styling patterns, writes mood_entries).
 *   2. Icon grid of 28 POTS/endo-specific activity toggles (custom_trackable_entries).
 *   3. Quick handoff buttons to the full LogCarousel or voice note.
 *
 * Design guarantees (per docs/plans/2026-04-17-wave-2e-briefs.md):
 *   - No typing required anywhere.
 *   - Saves are fire-and-forget with optimistic UI.
 *   - Lite log on a bad day is framed as a positive choice, not a fallback.
 *   - Icons from lucide-react, tinted with sage/blush palette tokens.
 *   - Tiles 64x64 minimum for 44px touch target compliance.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
  Bed, Brain, Briefcase, Car, Armchair, CloudSunRain, Coffee, Droplet,
  Droplets, Dumbbell, EyeClosed, Flame, Flower2, Footprints, HeartPulse,
  Moon, Pill, PillBottle, Salad, ShowerHead, Sun, ThermometerSun,
  UtensilsCrossed, Users, Waves, ZapOff, Mic, ChevronDown,
} from 'lucide-react'
import { saveMood } from '@/lib/api/mood'
import { saveTrackableEntry, deleteTrackableEntry } from '@/lib/api/custom-trackables'
import SaveIndicator from './SaveIndicator'
import {
  LITE_LOG_ACTIVITIES,
  groupActivitiesByCategory,
  categoryLabel,
  type LiteLogActivity,
  type LucideIconName,
} from '@/lib/lite-log/activities'
import type {
  MoodEntry,
  MoodScore,
  CustomTrackable,
  CustomTrackableEntry,
} from '@/lib/types'

interface LiteLogCardProps {
  /** Today's daily_logs.id */
  logId: string
  /** Existing mood entry for this log, if any. */
  initialMood: MoodEntry | null
  /** Custom trackable definitions from DB (joined with registry by name). */
  trackables: CustomTrackable[]
  /** Existing toggled entries so we can render initial selections. */
  trackableEntries: CustomTrackableEntry[]
  /** Optional hook called when the full-log handoff button is tapped. */
  onRequestFullLog?: () => void
  /** Optional hook called when the voice note button is tapped. */
  onRequestVoiceNote?: () => void
}

type IconComponent = React.ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean }>

// Icon registry: maps the string name stored in the registry (and DB) to
// the actual Lucide component. Extracting this lets us swap icon families
// without touching activities.ts.
const ICON_MAP: Record<LucideIconName, IconComponent> = {
  // lucide-react 1.8 has no dedicated `Socks` icon. Reusing Footprints keeps
  // the grid visually consistent and we disambiguate via the label + color.
  'socks': Footprints,
  'droplets': Droplets,
  'salad': Salad,
  'bed': Bed,
  'armchair': Armchair,
  'flame': Flame,
  'shower-head': ShowerHead,
  'utensils-crossed': UtensilsCrossed,
  'coffee': Coffee,
  'footprints': Footprints,
  'dumbbell': Dumbbell,
  'pill': Pill,
  'pill-bottle': PillBottle,
  'droplet': Droplet,
  'flower-2': Flower2,
  'zap-off': ZapOff,
  'brain': Brain,
  'thermometer-sun': ThermometerSun,
  'moon': Moon,
  'sun': Sun,
  'wind': Briefcase, // fallback for legacy names; current registry does not reference this
  'users': Users,
  'heart-pulse': HeartPulse,
  'cloud-sun-rain': CloudSunRain,
  'eye-closed': EyeClosed,
  'waves': Waves,
  'briefcase': Briefcase,
  'car': Car,
}

const MOOD_FACES: { score: MoodScore; label: string; emoji: string }[] = [
  { score: 1, label: 'Rough', emoji: '\u{1F629}' },
  { score: 2, label: 'Low', emoji: '\u{1F641}' },
  { score: 3, label: 'Okay', emoji: '\u{1F610}' },
  { score: 4, label: 'Good', emoji: '\u{1F642}' },
  { score: 5, label: 'Great', emoji: '\u{1F604}' },
]

function palette(color: 'sage' | 'blush', active: boolean) {
  if (color === 'sage') {
    return {
      bg: active ? 'var(--accent-sage-muted)' : 'var(--bg-elevated)',
      border: active ? 'var(--accent-sage)' : 'var(--border-light)',
      fg: active ? 'var(--accent-sage)' : 'var(--text-secondary)',
    }
  }
  return {
    bg: active ? 'var(--accent-blush-muted)' : 'var(--bg-elevated)',
    border: active ? 'var(--accent-blush)' : 'var(--border-light)',
    fg: active ? 'var(--accent-blush)' : 'var(--text-secondary)',
  }
}

export default function LiteLogCard({
  logId,
  initialMood,
  trackables,
  trackableEntries,
  onRequestFullLog,
  onRequestVoiceNote,
}: LiteLogCardProps) {
  const [selectedScore, setSelectedScore] = useState<MoodScore | null>(
    initialMood?.mood_score ?? null
  )
  const [expanded, setExpanded] = useState<boolean>(false)
  const [saved, setSaved] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Build registry <-> DB join by name. Each activity gets its DB trackable
  // row (if seeded) and the current toggled state. Activities without a DB
  // row are still rendered; tapping them is a no-op with an error toast so
  // the user knows the seed migration has not run yet.
  const resolvedActivities = useMemo(() => {
    const trackableByName = new Map(trackables.map((t) => [t.name, t]))
    const entryByTrackableId = new Map(
      trackableEntries.map((e) => [e.trackable_id, e])
    )
    return LITE_LOG_ACTIVITIES.map((activity) => {
      const trackable = trackableByName.get(activity.name) ?? null
      const entry = trackable ? entryByTrackableId.get(trackable.id) ?? null : null
      return {
        activity,
        trackable,
        initiallyToggled: entry?.toggled === true,
      }
    })
  }, [trackables, trackableEntries])

  // Local mirror of toggled state for optimistic UI. Keyed by trackable name
  // because the DB trackable id may be missing on first render.
  const [toggledByName, setToggledByName] = useState<Record<string, boolean>>(
    () => {
      const initial: Record<string, boolean> = {}
      for (const r of resolvedActivities) {
        if (r.initiallyToggled) initial[r.activity.name] = true
      }
      return initial
    }
  )

  const flashSaved = useCallback(() => {
    setSaved(true)
    const t = setTimeout(() => setSaved(false), 1500)
    return () => clearTimeout(t)
  }, [])

  const handleMoodSelect = useCallback(
    async (score: MoodScore) => {
      setSelectedScore(score)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        try {
          await saveMood(logId, score, initialMood?.emotions ?? [])
          flashSaved()
        } catch {
          // Silent failure: offline queue will retry
        }
      }, 300)
    },
    [logId, initialMood, flashSaved]
  )

  const handleToggle = useCallback(
    async (activity: LiteLogActivity, trackable: CustomTrackable | null) => {
      if (!trackable) {
        // Seed row missing - skip the DB write but do not crash the tile.
        return
      }
      const next = !toggledByName[activity.name]
      setToggledByName((prev) => ({ ...prev, [activity.name]: next }))
      try {
        if (next) {
          await saveTrackableEntry(logId, trackable.id, { toggled: true })
        } else {
          await deleteTrackableEntry(logId, trackable.id)
        }
        flashSaved()
      } catch {
        // Revert optimistic state on failure so the user sees the truth.
        setToggledByName((prev) => ({ ...prev, [activity.name]: !next }))
      }
    },
    [logId, toggledByName, flashSaved]
  )

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  const groups = useMemo(() => groupActivitiesByCategory(), [])

  return (
    <div
      className="card"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border-light)',
        borderRadius: '1rem',
      }}
      data-testid="lite-log-card"
    >
      <div className="px-4 py-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3
              className="text-base font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              Quick check-in
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Tap a face. Tap what helped or happened. Done in 30 seconds.
            </p>
          </div>
          <SaveIndicator show={saved} />
        </div>

        {/* Mood faces row */}
        <div
          className="flex justify-between gap-1"
          role="radiogroup"
          aria-label="How are you today?"
        >
          {MOOD_FACES.map(({ score, label, emoji }) => {
            const isSelected = selectedScore === score
            return (
              <button
                key={score}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={`${label} (${score} out of 5)`}
                onClick={() => handleMoodSelect(score)}
                className="press-feedback flex flex-col items-center gap-1.5 flex-1"
                style={{ minWidth: 48, minHeight: 64 }}
                data-testid={`lite-log-mood-${score}`}
              >
                <span
                  className="flex items-center justify-center rounded-full transition-all"
                  style={{
                    width: isSelected ? 52 : 44,
                    height: isSelected ? 52 : 44,
                    fontSize: isSelected ? 28 : 24,
                    background: isSelected
                      ? 'linear-gradient(135deg, rgba(107,144,128,0.18) 0%, rgba(107,144,128,0.10) 100%)'
                      : 'linear-gradient(180deg, #FDFDFB 0%, #F5F5F0 100%)',
                    border: isSelected
                      ? '2px solid var(--accent-sage)'
                      : '2px solid transparent',
                    boxShadow: isSelected
                      ? '0 2px 8px rgba(107,144,128,0.25)'
                      : 'inset 0 1px 0 rgba(255,255,255,0.8), 0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  {emoji}
                </span>
                <span
                  className="text-[11px] font-medium"
                  style={{
                    color: isSelected
                      ? 'var(--accent-sage)'
                      : 'var(--text-muted)',
                  }}
                >
                  {label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Activity icon grid - expandable to keep initial view scannable */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="press-feedback w-full flex items-center justify-between text-xs font-medium"
            style={{ color: 'var(--text-secondary)', minHeight: 36 }}
            aria-expanded={expanded}
            data-testid="lite-log-toggle-activities"
          >
            <span>
              {expanded
                ? 'Hide activities'
                : 'Tap what helped or what you noticed'}
            </span>
            <ChevronDown
              size={14}
              strokeWidth={2}
              style={{
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform var(--duration-fast) var(--ease-standard)',
              }}
              aria-hidden
            />
          </button>

          {expanded &&
            groups.map((group) => (
              <div key={group.category} className="space-y-2">
                <p
                  className="text-[10px] font-medium uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {categoryLabel(group.category)}
                </p>
                <div
                  className="grid grid-cols-4 gap-2"
                  role="group"
                  aria-label={categoryLabel(group.category)}
                >
                  {group.items.map((activity) => {
                    const resolved = resolvedActivities.find(
                      (r) => r.activity.name === activity.name
                    )
                    const trackable = resolved?.trackable ?? null
                    const isActive = toggledByName[activity.name] === true
                    const colors = palette(activity.palette, isActive)
                    const Icon = ICON_MAP[activity.icon]
                    return (
                      <button
                        key={activity.name}
                        type="button"
                        role="switch"
                        aria-checked={isActive}
                        aria-label={activity.description}
                        onClick={() => handleToggle(activity, trackable)}
                        disabled={!trackable}
                        className="press-feedback flex flex-col items-center justify-center gap-1 rounded-xl transition-all"
                        style={{
                          minWidth: 64,
                          minHeight: 72,
                          padding: '8px 4px',
                          background: colors.bg,
                          border: `1.5px solid ${colors.border}`,
                          color: colors.fg,
                          opacity: trackable ? 1 : 0.45,
                          cursor: trackable ? 'pointer' : 'not-allowed',
                        }}
                        data-testid={`lite-log-toggle-${activity.name}`}
                      >
                        <Icon size={22} strokeWidth={1.75} aria-hidden />
                        <span
                          className="text-[11px] font-medium text-center leading-tight"
                          style={{ color: colors.fg }}
                        >
                          {activity.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
        </div>

        {/* Footer handoff row */}
        <div
          className="flex items-center justify-between gap-2 pt-1"
          style={{ borderTop: '1px solid var(--border-light)' }}
        >
          {onRequestVoiceNote ? (
            <button
              type="button"
              onClick={onRequestVoiceNote}
              className="press-feedback inline-flex items-center gap-1.5 text-xs font-medium rounded-full"
              style={{
                minHeight: 36,
                padding: '8px 14px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-secondary)',
                marginTop: 8,
              }}
            >
              <Mic size={14} strokeWidth={1.75} aria-hidden />
              Voice note
            </button>
          ) : (
            <span />
          )}
          {onRequestFullLog && (
            <button
              type="button"
              onClick={onRequestFullLog}
              className="press-feedback text-xs font-medium"
              style={{
                minHeight: 36,
                color: 'var(--accent-sage)',
                textDecoration: 'underline',
                marginTop: 8,
              }}
            >
              Open full log
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
