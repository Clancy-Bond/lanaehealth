'use client'

/*
 * CitationsPanel
 *
 * Collapsible "Based on" panel rendered beneath each assistant
 * response that has citations attached. Each citation row shows the
 * source label (e.g. "Cycle entry 2026-04-18") and, when we know the
 * matching v2 surface, links to it as a deep-link so the user can
 * audit the data point that informed the claim.
 *
 * The panel is collapsed by default to keep the conversation
 * uncluttered; tapping the header toggles the list. Citation rows
 * are simple anchor tags so React Server Components can prefetch
 * and the URL is shareable.
 *
 * Citations are emitted from /api/chat as part of the `done` SSE
 * event (or the JSON `citations` field). The shape mirrors the
 * `ChatCitation` interface in src/app/api/chat/route.ts.
 */
import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, BookOpen } from 'lucide-react'

export interface ChatCitationView {
  kind: 'retrieval' | 'summary'
  label: string
  contentType?: string
  date?: string
  href?: string
}

interface CitationsPanelProps {
  citations: ChatCitationView[]
}

export default function CitationsPanel({ citations }: CitationsPanelProps) {
  const [open, setOpen] = useState(false)
  if (citations.length === 0) return null

  // De-dupe: assembler can return the same date twice if multiple
  // narrative chunks landed for one day. Keep the first occurrence.
  const seen = new Set<string>()
  const unique: ChatCitationView[] = []
  for (const c of citations) {
    const key = `${c.kind}|${c.label}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(c)
  }

  return (
    <div
      style={{
        marginTop: 6,
        background: 'var(--v2-bg-card)',
        border: '1px solid var(--v2-border-subtle)',
        borderRadius: 'var(--v2-radius-md)',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          padding: '8px 12px',
          background: 'transparent',
          border: 'none',
          color: 'var(--v2-text-secondary)',
          fontSize: 'var(--v2-text-xs)',
          fontWeight: 'var(--v2-weight-semibold)',
          letterSpacing: 'var(--v2-tracking-wide)',
          textTransform: 'uppercase',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <BookOpen size={12} aria-hidden="true" />
        <span style={{ flex: 1 }}>Based on {unique.length} record{unique.length === 1 ? '' : 's'}</span>
        <ChevronDown
          size={14}
          aria-hidden="true"
          style={{
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform var(--v2-duration-fast) var(--v2-ease-standard)',
          }}
        />
      </button>

      {open && (
        <ul
          style={{
            margin: 0,
            padding: '4px 8px 10px',
            listStyle: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            borderTop: '1px solid var(--v2-border-subtle)',
          }}
        >
          {unique.map((c, i) => (
            <li key={`${c.kind}-${c.label}-${i}`}>
              {c.href ? (
                <Link
                  href={c.href}
                  prefetch={false}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 'var(--v2-radius-sm)',
                    background: 'transparent',
                    color: 'var(--v2-accent-primary)',
                    fontSize: 'var(--v2-text-xs)',
                    fontWeight: 'var(--v2-weight-medium)',
                    textDecoration: 'none',
                    minHeight: 'var(--v2-touch-target-min)',
                  }}
                >
                  <span
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      background: 'var(--v2-accent-primary)',
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  />
                  <span style={{ flex: 1 }}>{c.label}</span>
                  <span
                    style={{
                      fontSize: 'var(--v2-text-xs)',
                      color: 'var(--v2-text-muted)',
                      fontWeight: 'var(--v2-weight-regular)',
                    }}
                  >
                    Open
                  </span>
                </Link>
              ) : (
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    color: 'var(--v2-text-secondary)',
                    fontSize: 'var(--v2-text-xs)',
                    fontWeight: 'var(--v2-weight-medium)',
                  }}
                >
                  <span
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      background: 'var(--v2-text-muted)',
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  />
                  {c.label}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
