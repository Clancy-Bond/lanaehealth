'use client'

/*
 * RecordsSearch (v2 records)
 *
 * Controlled search input with a clear button. Pure presentational; the
 * parent RecordsClient owns the query string and does the actual filter
 * work. We keep this isolated so the input visual can evolve without
 * touching filter logic.
 */

export interface RecordsSearchProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export default function RecordsSearch({
  value,
  onChange,
  placeholder = 'Search labs, imaging, appointments, milestones',
}: RecordsSearchProps) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 'var(--v2-space-3)',
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--v2-text-muted)',
          display: 'inline-flex',
          pointerEvents: 'none',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
        </svg>
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search your records"
        style={{
          width: '100%',
          minHeight: 'var(--v2-touch-target-min)',
          paddingLeft: 'calc(var(--v2-space-3) + 20px + var(--v2-space-2))',
          paddingRight: value ? 'calc(var(--v2-space-3) + 28px)' : 'var(--v2-space-3)',
          paddingTop: 'var(--v2-space-2)',
          paddingBottom: 'var(--v2-space-2)',
          fontSize: 'var(--v2-text-base)',
          color: 'var(--v2-text-primary)',
          background: 'var(--v2-bg-card)',
          border: '1px solid var(--v2-border)',
          borderRadius: 'var(--v2-radius-md)',
          outline: 'none',
          fontFamily: 'inherit',
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          style={{
            position: 'absolute',
            right: 'var(--v2-space-2)',
            top: '50%',
            transform: 'translateY(-50%)',
            minWidth: 44,
            minHeight: 44,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 0,
            color: 'var(--v2-text-muted)',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  )
}
