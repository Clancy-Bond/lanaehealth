'use client'

import { useEffect, useState } from 'react'

interface SaveIndicatorProps {
  show: boolean
}

export default function SaveIndicator({ show }: SaveIndicatorProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (show) {
      setVisible(true)
      const timer = setTimeout(() => setVisible(false), 1500)
      return () => clearTimeout(timer)
    }
  }, [show])

  if (!visible) return null

  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium"
      style={{
        color: 'var(--accent-sage)',
        animation: 'fadeInOut 1.5s ease forwards',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path
          d="M3 7L6 10L11 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Saved
    </span>
  )
}
