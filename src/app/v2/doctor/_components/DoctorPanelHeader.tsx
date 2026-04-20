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
 */
export interface DoctorPanelHeaderProps {
  title: ReactNode
  summary: ReactNode
  trailing?: ReactNode
}

export default function DoctorPanelHeader({ title, summary, trailing }: DoctorPanelHeaderProps) {
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
