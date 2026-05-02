'use client'

/*
 * GlossaryTerm
 *
 * NC's signature pedagogical detail (per docs/research/nc-pattern-
 * recognition-audit.md Section 7): inline body copy turns key terms
 * into tappable underlined "blue link" words ("common", "length",
 * "average", "variation"). Tap opens a small sheet with a one-
 * sentence definition. The pattern reduces the perceived complexity
 * of clinical copy because the reader can read the body and pull
 * definitions on demand instead of bouncing to a separate glossary.
 *
 * Section sessions consume this through props: pass the term and a
 * children prop with the definition body. The visible text inside the
 * sheet is the children; the visible inline text is the term itself.
 *
 * Implementation rules:
 *   - Inline element so it composes inside <p>, <span>, <li> bodies
 *     without breaking the line flow.
 *   - Underline is the only chrome cue; no color override unless the
 *     parent surface is the explanatory cream (where we use plum).
 *   - Sheet is dismissible via tap-outside (Sheet primitive already
 *     handles this).
 */
import { ReactNode, useState } from 'react'
import Sheet from './Sheet'

export interface GlossaryTermProps {
  /** The inline term as rendered in the body copy. */
  term: string
  /** The definition body. Renders inside the explainer Sheet. */
  children: ReactNode
  /**
   * Optional sheet title override. Defaults to the term itself with
   * sentence-case capitalization, which works for nearly every term.
   */
  sheetTitle?: string
  /**
   * Set true when the surrounding surface is the NC cream palette
   * (`.v2-surface-explanatory`). The underline tint shifts to NC plum
   * in that context so the chrome stays coherent.
   */
  explanatory?: boolean
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export default function GlossaryTerm({
  term,
  children,
  sheetTitle,
  explanatory,
}: GlossaryTermProps) {
  const [open, setOpen] = useState(false)
  const title = sheetTitle ?? titleCase(term)
  const underlineColor = explanatory
    ? 'var(--v2-surface-explanatory-cta, #5B2852)'
    : 'var(--v2-text-secondary)'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Define ${term}`}
        style={{
          display: 'inline',
          background: 'transparent',
          border: 'none',
          padding: 0,
          margin: 0,
          font: 'inherit',
          color: 'inherit',
          cursor: 'pointer',
          // Dotted underline reads as "definitional" without competing
          // with regular link affordances. Single-pixel offset keeps
          // baseline alignment clean.
          textDecoration: 'underline dotted',
          textUnderlineOffset: 2,
          textDecorationColor: underlineColor,
          textDecorationThickness: 1,
        }}
      >
        {term}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title} explanatory={explanatory}>
        <div style={{ fontSize: 'var(--v2-text-base)', lineHeight: 'var(--v2-leading-relaxed)' }}>
          {children}
        </div>
      </Sheet>
    </>
  )
}
