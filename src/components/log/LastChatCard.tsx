'use client'

import Link from 'next/link'
import { formatDistanceToNow, parseISO } from 'date-fns'
import type { CheckInPrefill } from '@/lib/log/prefill'

interface LastChatCardProps {
  chat: CheckInPrefill['lastChat']
}

export default function LastChatCard({ chat }: LastChatCardProps) {
  if (!chat || !chat.content) return null

  const stripped = chat.content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^#+\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .trim()

  const snippet = stripped.length > 180 ? stripped.slice(0, 180).trim() + '…' : stripped
  const when = (() => {
    try {
      return formatDistanceToNow(parseISO(chat.createdAt), { addSuffix: true })
    } catch {
      return 'recently'
    }
  })()

  return (
    <Link
      href="/chat"
      className="rounded-2xl p-4 block"
      style={{
        background: '#FFFDF9',
        border: '1px solid rgba(107, 144, 128, 0.15)',
        textDecoration: 'none',
      }}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-xs uppercase tracking-wide font-medium" style={{ color: '#6B9080' }}>
          Last from AI
        </span>
        <span className="text-xs" style={{ color: '#8a8a8a' }}>
          {when}
        </span>
      </div>
      <p className="text-sm leading-snug" style={{ color: '#3a3a3a' }}>
        {snippet}
      </p>
      <span className="text-xs underline mt-2 inline-block" style={{ color: '#6B9080' }}>
        Continue chat &rarr;
      </span>
    </Link>
  )
}
