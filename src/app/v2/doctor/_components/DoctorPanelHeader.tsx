'use client'

import type { ReactNode } from 'react'

/*
 * DoctorPanelHeader
 *
 * Every panel in Doctor Mode opens with title + a one-line summary a
 * doctor can read in under two seconds. This is the spec's hard rule:
 * doctors scan, they do not parse. Every card on the brief uses this
 * header so scanning the page top-to-bottom means reading the bold
 * line of each card.
 *
 * The summary is the most important sentence on the panel. Keep it
 * short, specific, and factual. Examples:
 *   "3 abnormal labs since last visit"
 *   "Standing HR 106 (+58 from resting)"
 *   "No new red flags"
 *
 * Optional trailing slot for a bucket badge or action chip.
 *
 * Optional onExplain handler renders a small "?" icon next to the
 * title that opens the panel's tap-to-learn explainer. The trigger
 * is intentionally subtle so it doesn't compete with the summary
 * line, but it has a real 32px tap target so it's reachable in clinic.
 */
export interface DoctorPanelHeaderProps {
  title: ReactNode
  summary: ReactNode
  trailing?: ReactNode
  onExplain?: () => void
  explainLabel?: string
}

export default function DoctorPanelHeader({
  title,
  summary,
  trailing,
  onExplain,
  explainLabel = 'Learn what this panel shows',
}: DoctorPanelHeaderProps) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 'var(--v2-space-3)',
        marginBottom: 'var(--v2-space-3)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--v2-space-2)' }}>
          <h3
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-base)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)',
              lineHeight: 'var(--v2-leading-tight)',
            }}
          >
            {title}
          </h3>
          {onExplain && (
            <button
              type="button"
              onClick={onExplain}
              aria-label={explainLabel}
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 22,
                height: 22,
                minWidth: 22,
                padding: 0,
                borderRadius: 'var(--v2-radius-full)',
                background: 'var(--v2-bg-elevated)',
                border: '1px solid var(--v2-border-subtle)',
                color: 'var(--v2-text-secondary)',
                cursor: 'pointer',
                fontSize: 'var(--v2-text-xs)',
                fontWeight: 'var(--v2-weight-semibold)',
                lineHeight: 1,
                fontFamily: 'inherit',
              }}
            >
              {/* Invisible >=44pt hit area for finger taps. */}
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  width: 'var(--v2-touch-target-min)',
                  height: 'var(--v2-touch-target-min)',
                  transform: 'translate(-50%, -50%)',
                }}
              />
              ?
            </button>
          )}
        </div>
        <p
          style={{
            margin: '2px 0 0 0',
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-secondary)',
            lineHeight: 'var(--v2-leading-normal)',
          }}
        >
          {summary}
        </p>
      </div>
      {trailing && <div style={{ flexShrink: 0 }}>{trailing}</div>}
    </header>
  )
}
