'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { saveMood } from '@/lib/api/mood'
import { updateDailyLog } from '@/lib/api/logs'
import type { MoodScore } from '@/lib/types'

interface QuickLogSheetProps {
  logId: string
  isOpen: boolean
  onClose: () => void
}

const MOOD_FACES: { score: MoodScore; label: string; emoji: string }[] = [
  { score: 1, label: 'Terrible', emoji: '\u{1F629}' },
  { score: 2, label: 'Bad', emoji: '\u{1F641}' },
  { score: 3, label: 'Okay', emoji: '\u{1F610}' },
  { score: 4, label: 'Good', emoji: '\u{1F642}' },
  { score: 5, label: 'Great', emoji: '\u{1F604}' },
]

const PAIN_VALUES = Array.from({ length: 11 }, (_, i) => i)

export default function QuickLogSheet({ logId, isOpen, onClose }: QuickLogSheetProps) {
  const router = useRouter()
  const [selectedMood, setSelectedMood] = useState<MoodScore | null>(null)
  const [selectedPain, setSelectedPain] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [visible, setVisible] = useState(false)
  const [animateIn, setAnimateIn] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragStartY = useRef<number | null>(null)
  const dragCurrentY = useRef<number>(0)

  // Handle open/close animation
  useEffect(() => {
    if (isOpen) {
      setVisible(true)
      // Trigger slide-up on next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimateIn(true)
        })
      })
    } else {
      setAnimateIn(false)
      const timer = setTimeout(() => setVisible(false), 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Handle drag-to-dismiss on the sheet
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragStartY.current === null) return
    const delta = e.touches[0].clientY - dragStartY.current
    if (delta > 0 && sheetRef.current) {
      dragCurrentY.current = delta
      sheetRef.current.style.transform = `translateY(${delta}px)`
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (dragCurrentY.current > 80) {
      onClose()
    } else if (sheetRef.current) {
      sheetRef.current.style.transform = ''
    }
    dragStartY.current = null
    dragCurrentY.current = 0
  }, [onClose])

  // Handle scrim click
  const handleScrimClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose()
      }
    },
    [onClose]
  )

  // Save and close
  const handleDone = useCallback(async () => {
    if (!selectedMood && selectedPain === null) {
      onClose()
      return
    }

    setSaving(true)
    try {
      const promises: Promise<unknown>[] = []

      if (selectedMood) {
        promises.push(saveMood(logId, selectedMood, []))
      }

      if (selectedPain !== null) {
        promises.push(updateDailyLog(logId, { overall_pain: selectedPain }))
      }

      await Promise.all(promises)
    } catch {
      // Silently fail, user can retry from full log
    } finally {
      setSaving(false)
      onClose()
    }
  }, [logId, selectedMood, selectedPain, onClose])

  if (!visible) return null

  return (
    <div
      onClick={handleScrimClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: animateIn ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0)',
        transition: 'background 300ms ease',
        display: 'flex',
        alignItems: 'flex-end',
      }}
    >
      <div
        ref={sheetRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          width: '100%',
          maxWidth: 480,
          margin: '0 auto',
          background: 'var(--bg-card, #FFFFFF)',
          borderRadius: '1.5rem 1.5rem 0 0',
          boxShadow: 'var(--shadow-lg, 0 -4px 24px rgba(0,0,0,0.12))',
          transform: animateIn ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)',
          paddingBottom: 'env(safe-area-inset-bottom, 16px)',
        }}
      >
        {/* Drag handle */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            paddingTop: 12,
            paddingBottom: 4,
          }}
        >
          <div
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              background: 'var(--border, #D1D5DB)',
            }}
          />
        </div>

        <div style={{ padding: '8px 20px 20px' }}>
          {/* Title */}
          <h2
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 20,
              textAlign: 'center',
            }}
          >
            Quick Check-in
          </h2>

          {/* Mood faces */}
          <div style={{ marginBottom: 20 }}>
            <p
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--text-secondary)',
                marginBottom: 10,
              }}
            >
              How are you feeling?
            </p>
            <div
              role="radiogroup"
              aria-label="Mood rating"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 4,
              }}
            >
              {MOOD_FACES.map(({ score, label, emoji }) => {
                const isSelected = selectedMood === score
                return (
                  <button
                    key={score}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={`${label} - ${score} out of 5`}
                    onClick={() => setSelectedMood(score)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      padding: 4,
                      minWidth: 48,
                      minHeight: 48,
                    }}
                  >
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: isSelected ? 52 : 44,
                        height: isSelected ? 52 : 44,
                        fontSize: isSelected ? 28 : 24,
                        borderRadius: '50%',
                        background: isSelected
                          ? 'var(--accent-sage-muted)'
                          : 'var(--bg-elevated, #F5F5F0)',
                        border: isSelected
                          ? '2px solid var(--accent-sage)'
                          : '2px solid transparent',
                        transition: 'all 150ms ease',
                      }}
                    >
                      {emoji}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
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
          </div>

          {/* Pain 0-10 row */}
          <div style={{ marginBottom: 24 }}>
            <p
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--text-secondary)',
                marginBottom: 10,
              }}
            >
              Pain level
            </p>
            <div
              role="radiogroup"
              aria-label="Pain level 0 to 10"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 2,
              }}
            >
              {PAIN_VALUES.map((val) => {
                const isSelected = selectedPain === val
                return (
                  <button
                    key={val}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={`Pain level ${val}`}
                    onClick={() => setSelectedPain(val)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      border: isSelected
                        ? '2px solid var(--accent-sage)'
                        : '1.5px solid var(--border-light, #E5E5E0)',
                      background: isSelected
                        ? 'var(--accent-sage)'
                        : 'var(--bg-elevated, #F5F5F0)',
                      color: isSelected ? '#FFFFFF' : 'var(--text-secondary)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                      transition: 'all 150ms ease',
                      minWidth: 30,
                      minHeight: 30,
                    }}
                  >
                    {val}
                  </button>
                )
              })}
            </div>
            {/* Pain labels */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 4,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  color: 'var(--text-muted)',
                }}
              >
                None
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: 'var(--text-muted)',
                }}
              >
                Worst
              </span>
            </div>
          </div>

          {/* Full Log link */}
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => {
                onClose()
                router.push('/log')
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-sage)',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                textDecoration: 'underline',
                textDecorationColor: 'var(--accent-sage-muted)',
                textUnderlineOffset: 3,
                padding: '8px 16px',
                minHeight: 44,
              }}
            >
              Open Full Log
            </button>
          </div>

          {/* Done button */}
          <button
            type="button"
            onClick={handleDone}
            disabled={saving}
            style={{
              width: '100%',
              padding: '14px 0',
              borderRadius: 12,
              border: 'none',
              background: 'var(--accent-sage, #6B9080)',
              color: '#FFFFFF',
              fontSize: 16,
              fontWeight: 600,
              cursor: saving ? 'wait' : 'pointer',
              opacity: saving ? 0.7 : 1,
              transition: 'opacity 150ms ease',
              minHeight: 48,
            }}
          >
            {saving ? 'Saving...' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  )
}
