'use client'

import Link from 'next/link'

interface AskAICtaProps {
  context?: 'morning' | 'evening'
}

export default function AskAICta({ context = 'evening' }: AskAICtaProps) {
  const prompt = context === 'morning'
    ? 'What should I watch for today given how the night went?'
    : 'Anything stand out about today compared to my usual?'

  const href = `/chat?q=${encodeURIComponent(prompt)}`

  return (
    <Link
      href={href}
      className="rounded-2xl p-4 flex items-center gap-3 transition"
      style={{
        background: 'linear-gradient(135deg, #F5F1ED 0%, #EBE4D9 100%)',
        border: '1px solid rgba(107, 144, 128, 0.2)',
        textDecoration: 'none',
      }}
    >
      <span
        className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg"
        style={{ background: '#6B9080', color: '#fff' }}
        aria-hidden
      >
        &#x2728;
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium" style={{ color: '#3a3a3a' }}>
          Ask AI about today
        </div>
        <div className="text-xs mt-0.5 truncate" style={{ color: '#6a6a6a' }}>
          {prompt}
        </div>
      </div>
      <span aria-hidden style={{ color: '#6B9080' }}>&#x2192;</span>
    </Link>
  )
}
