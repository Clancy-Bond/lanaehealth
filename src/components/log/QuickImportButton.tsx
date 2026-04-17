'use client'

import Link from 'next/link'

export default function QuickImportButton() {
  return (
    <Link
      href="/import"
      className="rounded-2xl p-4 flex items-center gap-3"
      style={{
        background: '#FFFDF9',
        border: '1px dashed rgba(107, 144, 128, 0.35)',
        textDecoration: 'none',
      }}
    >
      <span
        className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg"
        style={{ background: 'rgba(107, 144, 128, 0.1)', color: '#6B9080' }}
        aria-hidden
      >
        &#x1F4F7;
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium" style={{ color: '#3a3a3a' }}>
          Drop a photo, PDF, or export
        </div>
        <div className="text-xs mt-0.5" style={{ color: '#8a8a8a' }}>
          Labs, discharge papers, app exports. We&apos;ll parse and merge.
        </div>
      </div>
      <span aria-hidden style={{ color: '#6B9080' }}>&#x2192;</span>
    </Link>
  )
}
