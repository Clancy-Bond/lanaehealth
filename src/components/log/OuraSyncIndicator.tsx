'use client'

import { useState } from 'react'
import type { CheckInPrefill } from '@/lib/log/prefill'

interface OuraSyncIndicatorProps {
  ouraLastSync: CheckInPrefill['ouraLastSync']
}

export default function OuraSyncIndicator({ ouraLastSync }: OuraSyncIndicatorProps) {
  const [syncing, setSyncing] = useState(false)
  const [synced, setSynced] = useState(false)

  if (!ouraLastSync) return null
  const { daysAgo } = ouraLastSync

  const status =
    daysAgo === 0 ? 'synced' :
    daysAgo === 1 ? 'stale_1' :
    'stale_multi'

  const label =
    status === 'synced' ? <>Oura synced today</> :
    status === 'stale_1' ? <>Oura last synced yesterday</> :
    <>Oura last synced <span className="tabular">{daysAgo}</span> days ago</>

  const color =
    status === 'synced' ? '#6B9080' :
    status === 'stale_1' ? '#CCB167' :
    '#D4A0A0'

  const resync = async () => {
    setSyncing(true)
    try {
      await fetch('/api/oura/sync', { method: 'POST' }).catch(() => null)
      setSynced(true)
      setTimeout(() => window.location.reload(), 800)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div
      className="rounded-full px-3 py-1.5 flex items-center gap-2 text-xs"
      style={{
        background: '#FFFDF9',
        border: `1px solid ${color}55`,
        color: color,
        width: 'fit-content',
      }}
    >
      <span aria-hidden className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      <span>{label}</span>
      {status !== 'synced' ? (
        <button
          type="button"
          onClick={resync}
          disabled={syncing || synced}
          className="press-feedback underline font-medium"
          style={{ color, opacity: syncing ? 0.6 : 1 }}
        >
          {synced ? 'Done' : syncing ? 'Syncing' : 'Re-sync'}
        </button>
      ) : null}
    </div>
  )
}
