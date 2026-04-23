/**
 * TodayCyclePhase
 *
 * Compact cycle-phase tile that restates the current day and phase
 * in explanatory voice. Links to /v2/cycle for the full ring hero.
 */
import Link from 'next/link'
import { Card } from '@/v2/components/primitives'
import type { CycleContext } from '@/lib/cycle/load-cycle-context'

export interface TodayCyclePhaseProps {
  cycle: CycleContext | null
}

const PHRASE: Record<string, string> = {
  menstrual: 'Rest is productive today. Iron-rich meals and warmth tend to help.',
  follicular: 'Energy usually climbs through this week. Consider bigger tasks now.',
  ovulatory: 'Your body is in its strongest-feeling phase for a few days.',
  luteal: 'Winding toward your period. Gentler movement and earlier sleep help.',
}

export default function TodayCyclePhase({ cycle }: TodayCyclePhaseProps) {
  if (!cycle?.current?.day || !cycle.current.phase) {
    return (
      <Card padding="md">
        <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-secondary)' }}>
          Log a period to see your current cycle day and phase guidance here.
        </p>
        <Link
          href="/v2/cycle"
          style={{
            display: 'inline-block',
            marginTop: 'var(--v2-space-2)',
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-accent-primary)',
            textDecoration: 'none',
          }}
        >
          Open cycle →
        </Link>
      </Card>
    )
  }
  const { day, phase } = cycle.current
  const phaseLabel = phase[0].toUpperCase() + phase.slice(1)
  return (
    <Link href="/v2/cycle" style={{ textDecoration: 'none', color: 'inherit' }}>
      <Card padding="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-1)' }}>
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--v2-tracking-wide)',
              fontWeight: 'var(--v2-weight-medium)',
            }}
          >
            Cycle
          </span>
          <span
            style={{
              fontSize: 'var(--v2-text-xl)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)',
            }}
          >
            Day {day}, {phaseLabel} phase
          </span>
          <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-secondary)', lineHeight: 'var(--v2-leading-normal)' }}>
            {PHRASE[phase] ?? ''}
          </p>
        </div>
      </Card>
    </Link>
  )
}
