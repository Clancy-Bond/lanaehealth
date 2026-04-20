'use client'

/**
 * TimelineEventCard
 *
 * Single event as a tappable card. Opens the detail sheet which
 * shows the full description plus any linked_data hints the event
 * carries.
 *
 * Icon glyph comes from event_type so the reader can scan the
 * timeline visually. Significance bumps the accent color.
 */
import { useState } from 'react'
import type { MedicalTimelineEvent } from '@/lib/types'
import { Card } from '@/v2/components/primitives'
import ExplainerSheet from '../../_components/ExplainerSheet'

export interface TimelineEventCardProps {
  event: MedicalTimelineEvent
}

const TYPE_GLYPH: Record<MedicalTimelineEvent['event_type'], string> = {
  diagnosis: '⊕',
  symptom_onset: '!',
  test: '◇',
  medication_change: '℞',
  appointment: '◉',
  imaging: '◯',
  hospitalization: '⊠',
}

const TYPE_LABEL: Record<MedicalTimelineEvent['event_type'], string> = {
  diagnosis: 'Diagnosis',
  symptom_onset: 'Symptom onset',
  test: 'Test',
  medication_change: 'Medication change',
  appointment: 'Appointment',
  imaging: 'Imaging',
  hospitalization: 'Hospitalization',
}

function significanceColor(sig: MedicalTimelineEvent['significance']): string {
  switch (sig) {
    case 'critical':
      return 'var(--v2-accent-danger)'
    case 'important':
      return 'var(--v2-accent-warning)'
    default:
      return 'var(--v2-text-secondary)'
  }
}

function formatEventDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default function TimelineEventCard({ event }: TimelineEventCardProps) {
  const [open, setOpen] = useState(false)
  const accent = significanceColor(event.significance)
  return (
    <>
      <Card
        padding="md"
        onClick={() => setOpen(true)}
        role="button"
        style={{ cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', gap: 'var(--v2-space-3)', alignItems: 'flex-start' }}>
          <span
            aria-hidden
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--v2-radius-full)',
              background: 'var(--v2-bg-elevated)',
              border: `1px solid ${accent}`,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: accent,
              fontSize: 16,
            }}
          >
            {TYPE_GLYPH[event.event_type]}
          </span>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span
              style={{
                fontSize: 'var(--v2-text-xs)',
                color: accent,
                textTransform: 'uppercase',
                letterSpacing: 'var(--v2-tracking-wide)',
                fontWeight: 'var(--v2-weight-medium)',
              }}
            >
              On {formatEventDate(event.event_date)}, {TYPE_LABEL[event.event_type]}
            </span>
            <span
              style={{
                fontSize: 'var(--v2-text-base)',
                fontWeight: 'var(--v2-weight-semibold)',
                color: 'var(--v2-text-primary)',
              }}
            >
              {event.title}
            </span>
            {event.description && (
              <span
                style={{
                  fontSize: 'var(--v2-text-sm)',
                  color: 'var(--v2-text-secondary)',
                  lineHeight: 'var(--v2-leading-normal)',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {event.description}
              </span>
            )}
          </div>
        </div>
      </Card>

      <ExplainerSheet
        open={open}
        onClose={() => setOpen(false)}
        title={event.title}
      >
        <p style={{ margin: 0, fontSize: 'var(--v2-text-xs)', textTransform: 'uppercase', letterSpacing: 'var(--v2-tracking-wide)', color: 'var(--v2-surface-explanatory-muted)' }}>
          {formatEventDate(event.event_date)} &middot; {TYPE_LABEL[event.event_type]}
        </p>
        {event.description ? (
          <p style={{ margin: 0 }}>{event.description}</p>
        ) : (
          <p style={{ margin: 0, color: 'var(--v2-surface-explanatory-muted)' }}>
            No description was captured for this event.
          </p>
        )}
        {event.linked_data && Object.keys(event.linked_data).length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-1)' }}>
            <span
              style={{
                fontSize: 'var(--v2-text-xs)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--v2-tracking-wide)',
                color: 'var(--v2-surface-explanatory-muted)',
              }}
            >
              Linked details
            </span>
            {Object.entries(event.linked_data).map(([k, v]) => (
              <div key={k} style={{ fontSize: 'var(--v2-text-sm)' }}>
                <strong style={{ fontWeight: 'var(--v2-weight-semibold)' }}>{k}:</strong>{' '}
                {typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
                  ? String(v)
                  : JSON.stringify(v)}
              </div>
            ))}
          </div>
        )}
      </ExplainerSheet>
    </>
  )
}
