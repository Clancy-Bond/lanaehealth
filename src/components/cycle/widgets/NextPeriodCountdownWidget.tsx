import Link from 'next/link'
import { loadCycleContext } from '@/lib/cycle/load-cycle-context'
import { NextPeriodCountdown } from '@/components/cycle/NextPeriodCountdown'

export async function NextPeriodCountdownWidget({ date }: { date: string }) {
  const ctx = await loadCycleContext(date)

  return (
    <Link
      href="/cycle/predict"
      className="press-feedback"
      style={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <NextPeriodCountdown prediction={ctx.periodPrediction} size="widget" />
    </Link>
  )
}
