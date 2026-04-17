'use client'

import { useEffect, useState } from 'react'
import { queueSize } from '@/lib/log/offline-queue'
import { startOfflineAutoDrain } from '@/lib/log/offline-drain'

export default function OfflineQueueIndicator() {
  const [size, setSize] = useState(0)
  const [online, setOnline] = useState(true)

  useEffect(() => {
    const stopDrain = startOfflineAutoDrain()
    const sync = () => setSize(queueSize())
    sync()
    const onOnline = () => { setOnline(true); sync() }
    const onOffline = () => { setOnline(false); sync() }
    const poll = window.setInterval(sync, 5000)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    setOnline(navigator.onLine)
    return () => {
      stopDrain()
      window.clearInterval(poll)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  if (online && size === 0) return null

  return (
    <div
      className="fixed top-2 left-1/2 -translate-x-1/2 z-50 px-3 py-1.5 rounded-full text-xs font-medium shadow"
      style={{
        background: online ? '#E8D5B7' : '#D4A0A0',
        color: online ? '#3a2e1f' : '#fff',
      }}
      role="status"
      aria-live="polite"
    >
      {online
        ? `${size} pending save${size === 1 ? '' : 's'}`
        : `Offline \u2014 ${size} pending save${size === 1 ? '' : 's'}`}
    </div>
  )
}
