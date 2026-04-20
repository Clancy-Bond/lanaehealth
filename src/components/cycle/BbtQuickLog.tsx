/**
 * BBT quick log - inline form on the /cycle landing page.
 *
 * Preserves the Phase-0 BBT form but restyled to match warm-modern cards
 * and the rest of the clone tab.
 */
import { Thermometer } from 'lucide-react'
import { format } from 'date-fns'
import type { BbtEntry } from '@/lib/cycle/bbt-log'

export interface BbtQuickLogProps {
  latestBbt: BbtEntry | null
  confirmedOvulation: boolean
  todayISO: string
}

export function BbtQuickLog({ latestBbt, confirmedOvulation, todayISO }: BbtQuickLogProps) {
  return (
    <section
      className="card"
      style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Thermometer size={18} style={{ color: 'var(--accent-sage)' }} />
        <div style={{ fontSize: 14, fontWeight: 600 }}>Basal body temperature</div>
        {confirmedOvulation && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--accent-sage)',
              background: 'var(--accent-sage-muted)',
              padding: '3px 8px',
              borderRadius: 999,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Shift detected
          </span>
        )}
      </div>

      {latestBbt ? (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Latest:{' '}
          <strong className="tabular">
            {latestBbt.temp_f.toFixed(2)}&deg;F / {latestBbt.temp_c.toFixed(2)}&deg;C
          </strong>{' '}
          on {format(new Date(latestBbt.date + 'T00:00:00'), 'MMM d')}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          No BBT logged yet. Morning temperatures build the cover line over time.
        </div>
      )}

      <form
        action="/api/cycle/bbt"
        method="post"
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 120px' }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
            }}
          >
            Fahrenheit
          </span>
          <input
            type="number"
            step="0.01"
            min="86"
            max="113"
            name="temp_f"
            placeholder="97.90"
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid var(--border-light)',
              fontSize: 14,
              fontWeight: 600,
              background: 'var(--bg-input)',
            }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 120px' }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
            }}
          >
            Celsius
          </span>
          <input
            type="number"
            step="0.01"
            min="30"
            max="45"
            name="temp_c"
            placeholder="36.60"
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid var(--border-light)',
              fontSize: 14,
              fontWeight: 600,
              background: 'var(--bg-input)',
            }}
          />
        </label>
        <input type="hidden" name="date" value={todayISO} />
        <button
          type="submit"
          className="press-feedback"
          style={{
            padding: '11px 18px',
            borderRadius: 10,
            background: 'var(--accent-sage)',
            color: 'var(--text-inverse)',
            fontSize: 12,
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Log temp
        </button>
      </form>

      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
        Take BBT first thing after waking. Consistent timing matters more than
        precision. Sick, hungover, or short-sleep days are noisy and can be
        flagged when we add a BBT chart.
      </p>
    </section>
  )
}
