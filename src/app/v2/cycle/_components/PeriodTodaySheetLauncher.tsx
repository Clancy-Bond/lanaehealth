'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ListRow, Toggle } from '@/v2/components/primitives'

export interface PeriodTodaySheetLauncherProps {
  date: string
  initialMenstruating: boolean
}

export default function PeriodTodaySheetLauncher({ date, initialMenstruating }: PeriodTodaySheetLauncherProps) {
  const [checked, setChecked] = useState(initialMenstruating)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const onChange = (next: boolean) => {
    setChecked(next)
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/cycle/log', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ date, menstruation: next }),
        })
        if (!res.ok) {
          const msg = (await res.json().catch(() => null))?.error ?? 'Could not save'
          setError(msg)
          setChecked(!next)
          return
        }
        router.refresh()
      } catch {
        setError('Network error')
        setChecked(!next)
      }
    })
  }

  return (
    <ListRow
      label="Did your period start today?"
      subtext={error ?? (pending ? 'Saving…' : 'Honest flow shapes tomorrow\u2019s predictions.')}
      intent={error ? 'warning' : 'default'}
      divider={false}
      trailing={<Toggle checked={checked} onChange={onChange} disabled={pending} />}
    />
  )
}
