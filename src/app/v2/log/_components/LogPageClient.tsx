'use client'

/**
 * LogPageClient
 *
 * Client wrapper around the chronological note feed on /v2/log. Owns:
 *   - the "+ Add a note" button that opens NoteComposer
 *   - the feed of saved notes (server-loaded initial set; refreshed
 *     after a save by Next router.refresh())
 */
import { useState } from 'react'
import { Card } from '@/v2/components/primitives'
import NoteComposer from '@/v2/components/notes/NoteComposer'
import type { NoteRow } from '@/lib/notes/save-note'

interface Props {
  initialNotes: NoteRow[]
}

export default function LogPageClient({ initialNotes }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Card padding="md">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: initialNotes.length === 0 ? 0 : 'var(--v2-space-3)',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-lg)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)',
            }}
          >
            Notes
          </h2>
          <button
            type="button"
            onClick={() => setOpen(true)}
            style={{
              appearance: 'none',
              background: 'var(--v2-accent-primary)',
              color: 'var(--v2-on-accent)',
              border: 'none',
              borderRadius: 'var(--v2-radius-full)',
              padding: 'var(--v2-space-1) var(--v2-space-3)',
              fontFamily: 'inherit',
              fontSize: 'var(--v2-text-sm)',
              fontWeight: 'var(--v2-weight-semibold)',
              cursor: 'pointer',
              minHeight: 36,
            }}
          >
            + Add a note
          </button>
        </div>

        {initialNotes.length === 0 ? (
          <EmptyFeed onAdd={() => setOpen(true)} />
        ) : (
          <NoteFeed notes={initialNotes} />
        )}
      </Card>

      <NoteComposer open={open} onClose={() => setOpen(false)} />
    </>
  )
}

// ── Empty state ────────────────────────────────────────────────────

function EmptyFeed({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 'var(--v2-space-2)',
        padding: 'var(--v2-space-3) 0 var(--v2-space-1) 0',
      }}
    >
      <p
        style={{
          margin: 0,
          color: 'var(--v2-text-secondary)',
          fontSize: 'var(--v2-text-sm)',
          lineHeight: 1.5,
        }}
      >
        Nothing logged yet. Tap to drop a quick note about how you are
        feeling, what helped, or what just happened.
      </p>
      <button
        type="button"
        onClick={onAdd}
        style={{
          appearance: 'none',
          background: 'transparent',
          color: 'var(--v2-accent-primary)',
          border: 'none',
          padding: 0,
          fontFamily: 'inherit',
          fontSize: 'var(--v2-text-sm)',
          fontWeight: 'var(--v2-weight-semibold)',
          cursor: 'pointer',
        }}
      >
        Drop your first note →
      </button>
    </div>
  )
}

// ── Feed ───────────────────────────────────────────────────────────

function NoteFeed({ notes }: { notes: NoteRow[] }) {
  // Group by ISO date so the user sees natural day separators.
  const grouped = groupByDate(notes)
  return (
    <ul
      style={{
        listStyle: 'none',
        padding: 0,
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-4)',
      }}
    >
      {grouped.map(([date, dayNotes]) => (
        <li key={date}>
          <div
            style={{
              fontSize: 'var(--v2-text-xs)',
              fontWeight: 'var(--v2-weight-semibold)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--v2-text-muted)',
              marginBottom: 'var(--v2-space-2)',
            }}
          >
            {formatDateHeading(date)}
          </div>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--v2-space-2)',
            }}
          >
            {dayNotes.map((n) => (
              <NoteRowDisplay key={n.id} note={n} />
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}

function NoteRowDisplay({ note }: { note: NoteRow }) {
  const sourceIcon = note.source === 'voice' ? '🎤' : note.source === 'mixed' ? '🎤+✏️' : '✏️'
  const extractionsCount = Array.isArray(note.applied_extractions)
    ? note.applied_extractions.length
    : 0
  return (
    <li
      style={{
        padding: 'var(--v2-space-3)',
        borderRadius: 'var(--v2-radius-md)',
        background: 'var(--v2-bg-card-muted, rgba(255,255,255,0.03))',
        border: '1px solid var(--v2-border-subtle)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--v2-space-2)',
          marginBottom: 'var(--v2-space-2)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-text-muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatTimeOnly(note.captured_at)} {sourceIcon}
        </span>
        {extractionsCount > 0 && (
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-accent-primary)',
              padding: '2px var(--v2-space-2)',
              borderRadius: 'var(--v2-radius-full)',
              background: 'var(--v2-accent-primary-soft)',
            }}
          >
            {extractionsCount} stamped
          </span>
        )}
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-base)',
          lineHeight: 1.5,
          color: 'var(--v2-text-primary)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {note.body}
      </p>
    </li>
  )
}

// ── Helpers ────────────────────────────────────────────────────────

function groupByDate(notes: NoteRow[]): Array<[string, NoteRow[]]> {
  const map = new Map<string, NoteRow[]>()
  for (const n of notes) {
    const date = n.captured_at.slice(0, 10)
    const arr = map.get(date)
    if (arr) arr.push(n)
    else map.set(date, [n])
  }
  // Already sorted descending by captured_at on the server.
  return Array.from(map.entries())
}

function formatTimeOnly(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function formatDateHeading(iso: string): string {
  const todayIso = new Date().toISOString().slice(0, 10)
  if (iso === todayIso) return 'Today'
  const y = new Date(Date.parse(todayIso + 'T00:00:00Z') - 86_400_000)
    .toISOString()
    .slice(0, 10)
  if (iso === y) return 'Yesterday'
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}
