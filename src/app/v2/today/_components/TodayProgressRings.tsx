/**
 * TodayProgressRings
 *
 * Three small rings showing how complete today is across the three
 * dimensions we care about: subjective check-ins, objective vitals
 * (Oura), and body signals (symptoms / pain). Each ring is a Link
 * to the relevant drill route so the reader can top up what is low.
 */
import Link from 'next/link'
import { Card, MetricRing } from '@/v2/components/primitives'

export interface TodayProgressRingsProps {
  checkInsLogged: number
  checkInsTotal: number
  vitalsLogged: number
  vitalsTotal: number
  symptomsLogged: number
}

export default function TodayProgressRings({
  checkInsLogged,
  checkInsTotal,
  vitalsLogged,
  vitalsTotal,
  symptomsLogged,
}: TodayProgressRingsProps) {
  const checkInPct = safePct(checkInsLogged, checkInsTotal)
  const vitalsPct = safePct(vitalsLogged, vitalsTotal)
  const symptomsPct = symptomsLogged > 0 ? 100 : 0

  return (
    <Card padding="md">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 'var(--v2-space-3)',
        }}
      >
        <RingLink
          href="/v2/log"
          pct={checkInPct}
          displayValue={`${checkInsLogged}/${checkInsTotal}`}
          label="Check-ins"
          color="var(--v2-accent-primary)"
          subtext={checkInsLogged >= checkInsTotal ? 'Complete' : 'Tap to add'}
        />
        <RingLink
          href="/v2/sleep"
          pct={vitalsPct}
          displayValue={`${vitalsLogged}/${vitalsTotal}`}
          label="Vitals"
          color="var(--v2-ring-sleep)"
          subtext={vitalsLogged >= vitalsTotal ? 'Synced' : 'Waiting for sync'}
        />
        <RingLink
          href="/v2/log"
          pct={symptomsPct}
          displayValue={symptomsLogged.toString()}
          label="Symptoms"
          color={symptomsLogged === 0 ? 'var(--v2-accent-success)' : 'var(--v2-accent-warning)'}
          subtext={symptomsLogged === 0 ? 'None yet' : 'Logged today'}
        />
      </div>
    </Card>
  )
}

function safePct(n: number, d: number): number {
  if (d <= 0) return 0
  return Math.max(0, Math.min(100, (n / d) * 100))
}

function RingLink({
  href,
  pct,
  displayValue,
  label,
  subtext,
  color,
}: {
  href: string
  pct: number
  displayValue: string
  label: string
  subtext: string
  color: string
}) {
  return (
    <Link
      href={href}
      aria-label={`${label}: ${subtext}`}
      style={{
        textDecoration: 'none',
        color: 'inherit',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--v2-space-2)',
        padding: 'var(--v2-space-3)',
        borderRadius: 'var(--v2-radius-md)',
        minHeight: 'var(--v2-touch-target-min)',
      }}
    >
      <MetricRing value={pct} size="sm" color={color} displayValue={displayValue} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 'var(--v2-text-sm)', fontWeight: 'var(--v2-weight-medium)', color: 'var(--v2-text-primary)' }}>
          {label}
        </div>
        <div style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)', marginTop: 2 }}>
          {subtext}
        </div>
      </div>
    </Link>
  )
}
