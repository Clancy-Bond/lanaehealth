'use client'

/**
 * Data Completeness Ring
 *
 * Shows which data sources have been logged today.
 * Encourages complete daily tracking without being preachy.
 */

interface DataSource {
  id: string
  label: string
  icon: string
  logged: boolean
}

interface DataCompletenessProps {
  sources: DataSource[]
}

export default function DataCompleteness({ sources }: DataCompletenessProps) {
  const logged = sources.filter(s => s.logged).length
  const total = sources.length
  const pct = total > 0 ? Math.round(logged / total * 100) : 0

  // SVG circle math
  const radius = 32
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (pct / 100) * circumference

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}
    >
      <div className="flex items-center gap-4">
        {/* Progress ring */}
        <div className="relative shrink-0" style={{ width: 72, height: 72 }}>
          <svg width="72" height="72" viewBox="0 0 72 72">
            <circle
              cx="36" cy="36" r={radius}
              fill="none"
              stroke="var(--bg-elevated)"
              strokeWidth="5"
            />
            <circle
              cx="36" cy="36" r={radius}
              fill="none"
              stroke="var(--accent-sage)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 36 36)"
              style={{ transition: 'stroke-dashoffset var(--duration-slow) var(--ease-decelerate)' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold tabular" style={{ color: 'var(--accent-sage)' }}>
              {logged}/{total}
            </span>
          </div>
        </div>

        {/* Sources */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            How today looks so far
          </p>
          <div className="flex flex-wrap gap-1.5">
            {sources.map(source => (
              <span
                key={source.id}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{
                  background: source.logged ? 'var(--accent-sage-muted)' : 'var(--bg-elevated)',
                  color: source.logged ? 'var(--accent-sage)' : 'var(--text-muted)',
                  textDecoration: source.logged ? 'none' : 'none',
                  opacity: source.logged ? 1 : 0.6,
                }}
              >
                <span>{source.icon}</span>
                {source.label}
                {source.logged && ' \u2713'}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
