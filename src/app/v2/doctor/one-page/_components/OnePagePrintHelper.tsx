'use client'

/**
 * Screen-only chrome for the one-page handoff: a "Print this page"
 * button plus print-only CSS that hides the app shell when the user
 * actually prints. The printable surface itself is rendered by the
 * server page; this client component is purely UX scaffolding.
 *
 * Pattern source: bearable.app's printable worksheets - surface a
 * single, obvious print affordance and hide everything that is not
 * the page itself when it hits the printer.
 */
import { useCallback } from 'react'

export default function OnePagePrintHelper() {
  const onPrint = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.print()
    }
  }, [])

  return (
    <>
      <style>{`
        @media print {
          /* Strip the app chrome on print so only the printable
             surface inside this route reaches the page. */
          [data-v2-shell-top],
          [data-v2-shell-bottom],
          .v2-print-hide {
            display: none !important;
          }
          .v2-surface-explanatory {
            background: white !important;
            color: black !important;
          }
          a {
            color: black !important;
            text-decoration: none !important;
          }
        }
      `}</style>
      <div
        className="v2-print-hide"
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: 'var(--v2-space-3)',
        }}
      >
        <button
          type="button"
          onClick={onPrint}
          style={{
            padding: 'var(--v2-space-2) var(--v2-space-4)',
            borderRadius: 'var(--v2-radius-pill)',
            border: '1px solid var(--v2-surface-explanatory-border)',
            background: 'var(--v2-surface-explanatory-card)',
            color: 'var(--v2-surface-explanatory-text)',
            fontSize: 'var(--v2-text-sm)',
            fontWeight: 'var(--v2-weight-medium)',
            cursor: 'pointer',
            minHeight: 'var(--v2-touch-target-min)',
          }}
        >
          Print this page
        </button>
      </div>
    </>
  )
}
