'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { saveMood } from '@/lib/api/mood'
import type { MoodEntry, MoodScore, EmotionTag } from '@/lib/types'
import SaveIndicator from './SaveIndicator'

interface MoodCardProps {
  logId: string
  initialMood: MoodEntry | null
  onComplete?: () => void
}

const MOOD_FACES: { score: MoodScore; label: string; emoji: string }[] = [
  { score: 1, label: 'Terrible', emoji: '\u{1F629}' },
  { score: 2, label: 'Bad', emoji: '\u{1F641}' },
  { score: 3, label: 'Okay', emoji: '\u{1F610}' },
  { score: 4, label: 'Good', emoji: '\u{1F642}' },
  { score: 5, label: 'Great', emoji: '\u{1F604}' },
]

// Grouped by valence for better UX (research: flat list of 17 pills overwhelms users)
const EMOTION_GROUPS: { label: string; className: string; tags: EmotionTag[] }[] = [
  {
    label: 'Positive',
    className: 'emotion-group-positive',
    tags: ['happy', 'calm', 'energetic', 'grateful', 'hopeful', 'peaceful', 'content', 'motivated'],
  },
  {
    label: 'Difficult',
    className: 'emotion-group-negative',
    tags: ['anxious', 'irritable', 'sad', 'frustrated', 'overwhelmed', 'tearful'],
  },
  {
    label: 'Other',
    className: 'emotion-group-neutral',
    tags: ['numb', 'foggy', 'restless'],
  },
]

export default function MoodCard({
  logId,
  initialMood,
  onComplete,
}: MoodCardProps) {
  const [selectedScore, setSelectedScore] = useState<MoodScore | null>(
    initialMood?.mood_score ?? null
  )
  const [selectedEmotions, setSelectedEmotions] = useState<EmotionTag[]>(
    initialMood?.emotions ?? []
  )
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasCalledComplete = useRef(!!initialMood)

  // Trigger onComplete when first data is entered
  useEffect(() => {
    if (!hasCalledComplete.current && selectedScore !== null && onComplete) {
      hasCalledComplete.current = true
      onComplete()
    }
  }, [selectedScore, onComplete])

  const debouncedSave = useCallback(
    (score: MoodScore, emotions: EmotionTag[]) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        setSaving(true)
        try {
          await saveMood(logId, score, emotions)
          setSaved(true)
          setTimeout(() => setSaved(false), 1600)
        } catch {
          // Silently fail, user can retry
        } finally {
          setSaving(false)
        }
      }, 500)
    },
    [logId]
  )

  const handleMoodSelect = useCallback(
    (score: MoodScore) => {
      setSelectedScore(score)
      debouncedSave(score, selectedEmotions)
    },
    [selectedEmotions, debouncedSave]
  )

  const handleEmotionToggle = useCallback(
    (emotion: EmotionTag) => {
      if (selectedScore === null) return
      setSelectedEmotions((prev) => {
        const next = prev.includes(emotion)
          ? prev.filter((e) => e !== emotion)
          : [...prev, emotion]
        debouncedSave(selectedScore, next)
        return next
      })
    },
    [selectedScore, debouncedSave]
  )

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  return (
    <div
      className="card"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border-light)',
        borderRadius: '1rem',
      }}
    >
      <div className="px-4 py-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3
            className="text-base font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            How are you feeling?
          </h3>
          <SaveIndicator show={saved} />
        </div>

        {/* Mood faces row */}
        <div
          className="flex justify-between"
          role="radiogroup"
          aria-label="Mood rating"
        >
          {MOOD_FACES.map(({ score, label, emoji }) => {
            const isSelected = selectedScore === score
            return (
              <button
                key={score}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={`${label} - ${score} out of 5`}
                onClick={() => handleMoodSelect(score)}
                className="flex flex-col items-center gap-1.5 transition-all"
                style={{ minWidth: 48, minHeight: 48 }}
              >
                <span
                  className="flex items-center justify-center rounded-full transition-all"
                  style={{
                    width: isSelected ? 56 : 48,
                    height: isSelected ? 56 : 48,
                    fontSize: isSelected ? 32 : 28,
                    background: isSelected
                      ? 'linear-gradient(135deg, rgba(107,144,128,0.18) 0%, rgba(107,144,128,0.10) 100%)'
                      : 'linear-gradient(180deg, #FDFDFB 0%, #F5F5F0 100%)',
                    border: isSelected
                      ? '2px solid var(--accent-sage)'
                      : '2px solid transparent',
                    boxShadow: isSelected
                      ? '0 2px 8px rgba(107,144,128,0.25), inset 0 1px 0 rgba(255,255,255,0.4)'
                      : 'inset 0 1px 0 rgba(255,255,255,0.8), 0 1px 3px rgba(0,0,0,0.04)',
                    transform: isSelected ? 'scale(1.1)' : 'scale(1)',
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

        {/* Emotion tags */}
        {selectedScore !== null && (
          <div className="space-y-3">
            <p
              className="text-xs font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              What emotions are present?
            </p>
            {EMOTION_GROUPS.map((group) => (
              <div key={group.label} className={group.className}>
                <p
                  className="text-[10px] font-medium uppercase tracking-wider mb-1.5"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {group.label}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {group.tags.map((emotion) => {
                    const isActive = selectedEmotions.includes(emotion)
                    return (
                      <button
                        key={emotion}
                        type="button"
                        onClick={() => handleEmotionToggle(emotion)}
                        aria-pressed={isActive}
                        className="rounded-full px-3 py-1.5 text-[13px] font-medium transition-all"
                        style={{
                          background: isActive
                            ? 'var(--accent-sage-muted)'
                            : 'var(--bg-elevated)',
                          color: isActive
                            ? 'var(--accent-sage)'
                            : 'var(--text-secondary)',
                          border: isActive
                            ? '1.5px solid var(--accent-sage)'
                            : '1.5px solid transparent',
                          minHeight: 36,
                        }}
                      >
                        {emotion}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Saving indicator (screen reader) */}
        {saving && (
          <span className="sr-only" role="status">
            Saving mood...
          </span>
        )}
      </div>
    </div>
  )
}
