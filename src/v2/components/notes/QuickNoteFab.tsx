'use client'

/**
 * QuickNoteFab
 *
 * Replaces HomeQuickActionFab on /v2 home. The FAB tap opens the note
 * composer modal directly (no menu in between). Long-press OR
 * right-click reveals a small action sheet with Ask AI.
 *
 * Why not a menu by default: user research showed Lanae logs almost
 * exclusively notes; the Take a Photo / Scan barcode items belong inside
 * the calories section. Stripping the menu means the most common path
 * is one tap, not two.
 *
 * After save, this shell fires AI extraction in the background and
 * surfaces the result as a chip toast above the bottom tab bar. Tap
 * a chip = stamp the structured row.
 */
import { useState } from 'react'
import Link from 'next/link'
import { Sparkles, Plus } from 'lucide-react'
import NoteComposer from './NoteComposer'
import ExtractionChipToast from './ExtractionChipToast'
import type { Extraction } from '@/lib/notes/extraction-types'

export default function QuickNoteFab() {
  const [open, setOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [toast, setToast] = useState<{
    noteId: string
    extractions: Extraction[]
  } | null>(null)

  async function fireExtraction(noteId: string) {
    try {
      const resp = await fetch(`/api/notes/${noteId}/extract`, { method: 'POST' })
      if (!resp.ok) return
      const data = (await resp.json()) as { extractions?: Extraction[] }
      const extractions = data.extractions ?? []
      if (extractions.length === 0) return
      setToast({ noteId, extractions })
    } catch {
      // Silent: extraction is bonus, the verbatim note is already saved.
    }
  }

  return (
    <>
      <div
        style={{
          position: 'fixed',
          right: 'calc(var(--v2-space-4) + var(--v2-safe-right))',
          bottom: `calc(var(--v2-tabbar-height) + var(--v2-safe-bottom) + var(--v2-space-4))`,
          zIndex: 30,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 'var(--v2-space-2)',
        }}
      >
        {menuOpen && (
          <Link
            href="/v2/chat"
            prefetch={false}
            onClick={() => setMenuOpen(false)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--v2-space-2)',
              padding: 'var(--v2-space-2) var(--v2-space-4)',
              background: 'var(--v2-bg-elevated)',
              color: 'var(--v2-text-primary)',
              borderRadius: 'var(--v2-radius-full)',
              boxShadow: 'var(--v2-shadow-md)',
              textDecoration: 'none',
              fontSize: 'var(--v2-text-sm)',
              fontWeight: 'var(--v2-weight-semibold)',
              border: '1px solid var(--v2-border-subtle)',
            }}
          >
            <Sparkles size={16} aria-hidden="true" />
            Ask AI
          </Link>
        )}

        <button
          type="button"
          aria-label="Add a note"
          onClick={() => {
            if (menuOpen) {
              setMenuOpen(false)
              return
            }
            setOpen(true)
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            setMenuOpen((v) => !v)
          }}
          onPointerDown={(e) => {
            // Long-press to open the secondary menu.
            const t = window.setTimeout(() => setMenuOpen(true), 500)
            const cancel = () => {
              window.clearTimeout(t)
              e.currentTarget.removeEventListener('pointerup', cancel)
              e.currentTarget.removeEventListener('pointercancel', cancel)
              e.currentTarget.removeEventListener('pointerleave', cancel)
            }
            e.currentTarget.addEventListener('pointerup', cancel)
            e.currentTarget.addEventListener('pointercancel', cancel)
            e.currentTarget.addEventListener('pointerleave', cancel)
          }}
          style={{
            width: 'var(--v2-fab-size)',
            height: 'var(--v2-fab-size)',
            borderRadius: 'var(--v2-radius-full)',
            background: 'var(--v2-accent-primary)',
            color: 'var(--v2-on-accent)',
            border: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--v2-shadow-lg)',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <Plus size={28} aria-hidden="true" strokeWidth={2.4} />
        </button>
      </div>

      <NoteComposer
        open={open}
        onClose={() => setOpen(false)}
        onSaved={({ noteId }) => {
          // Fire extraction in the background after the modal dismisses
          // so the user is back on home (or wherever) when the chips
          // arrive ~1-3s later.
          window.setTimeout(() => void fireExtraction(noteId), 200)
        }}
      />

      {toast && (
        <ExtractionChipToast
          noteId={toast.noteId}
          extractions={toast.extractions}
          onClose={() => setToast(null)}
        />
      )}
    </>
  )
}
