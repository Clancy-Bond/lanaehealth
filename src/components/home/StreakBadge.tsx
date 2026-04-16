'use client'

/**
 * Streak Badge
 *
 * Shows consecutive days of logging with a fire animation.
 * No shame for broken streaks -- shows cumulative stats instead.
 */

interface StreakBadgeProps {
  currentStreak: number
  longestStreak: number
  totalDaysLogged: number
}

export default function StreakBadge({ currentStreak, longestStreak, totalDaysLogged }: StreakBadgeProps) {
  if (totalDaysLogged === 0) return null

  return (
    <div
      className="flex items-center gap-3 rounded-xl p-3"
      style={{
        background: currentStreak >= 3 ? 'var(--accent-sage-muted)' : 'var(--bg-card)',
        border: `1px solid ${currentStreak >= 3 ? 'var(--accent-sage)' : 'var(--border-light)'}`,
      }}
    >
      {/* Flame icon */}
      <div className="text-2xl">
        {currentStreak >= 7 ? '\u{1F525}' : currentStreak >= 3 ? '\u{1F31F}' : '\u{2728}'}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span
            className="text-lg font-bold"
            style={{ color: currentStreak >= 3 ? 'var(--accent-sage)' : 'var(--text-primary)' }}
          >
            {currentStreak} day{currentStreak !== 1 ? 's' : ''}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            current streak
          </span>
        </div>
        <div className="flex gap-3 mt-0.5">
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            Best: {longestStreak}d
          </span>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            Total: {totalDaysLogged}d logged
          </span>
        </div>
      </div>
    </div>
  )
}
