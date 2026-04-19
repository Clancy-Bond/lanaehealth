import Link from 'next/link'
import { loadCycleContext } from '@/lib/cycle/load-cycle-context'
import { FertilitySignalCard } from '@/components/cycle/FertilitySignalCard'

export async function FertilityWindowWidget({ date }: { date: string }) {
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
      <FertilitySignalCard
        prediction={ctx.fertilePrediction}
        confirmedOvulation={ctx.confirmedOvulation}
        size="widget"
      />
    </Link>
  )
}
