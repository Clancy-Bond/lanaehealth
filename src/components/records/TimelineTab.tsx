'use client'

import { useState, useMemo, useCallback } from 'react'
import { History } from 'lucide-react'
import type { MedicalTimelineEvent, TimelineEventType } from '@/lib/types'
import { AddEventForm } from '@/components/timeline/AddEventForm'

type FilterId = 'all' | TimelineEventType

const filterChips: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'diagnosis', label: 'Diagnoses' },
  { id: 'test', label: 'Tests' },
  { id: 'medication_change', label: 'Medications' },
  { id: 'appointment', label: 'Appointments' },
  { id: 'imaging', label: 'Imaging' },
  { id: 'symptom_onset', label: 'Symptoms' },
  { id: 'hospitalization', label: 'Hospital' },
]

function eventColor(type: TimelineEventType): string {
  switch (type) {
    case 'diagnosis':
      return 'var(--event-diagnosis)'
    case 'symptom_onset':
      return 'var(--event-symptom)'
    case 'test':
      return 'var(--event-test)'
    case 'medication_change':
      return 'var(--event-medication)'
    case 'appointment':
      return 'var(--event-appointment)'
    case 'imaging':
      return 'var(--event-imaging)'
    case 'hospitalization':
      // Soft blush for gravity without alarm; aligns with §6 / §7.
      return 'var(--accent-blush)'
    default:
      return 'var(--text-muted)'
  }
}

function eventTypeLabel(type: TimelineEventType): string {
  switch (type) {
    case 'diagnosis':
      return 'Diagnosis'
    case 'symptom_onset':
      return 'Symptom'
    case 'test':
      return 'Test'
    case 'medication_change':
      return 'Medication'
    case 'appointment':
      return 'Appointment'
    case 'imaging':
      return 'Imaging'
    case 'hospitalization':
      return 'Hospital'
    default:
      return type
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function significanceBadge(sig: string): { label: string; bg: string; color: string } | null {
  switch (sig) {
    case 'critical':
      // Softened: blush-toned, not saturated red.
      return { label: 'Watch closely', bg: 'rgba(212, 160, 160, 0.18)', color: '#8C5A5A' }
    case 'important':
      return { label: 'Important', bg: 'rgba(217, 169, 78, 0.14)', color: '#9A7A2C' }
    default:
      return null
  }
}

interface TimelineTabProps {
  events: MedicalTimelineEvent[]
}

export function TimelineTab({ events: initialEvents }: TimelineTabProps) {
  const [events, setEvents] = useState<MedicalTimelineEvent[]>(initialEvents)
  const [filter, setFilter] = useState<FilterId>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (filter === 'all') return events
    return events.filter((e) => e.event_type === filter)
  }, [events, filter])

  const toggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const handleEventAdded = useCallback((newEvent: MedicalTimelineEvent) => {
    setEvents((prev) => {
      const updated = [newEvent, ...prev]
      updated.sort(
        (a, b) =>
          new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
      )
      return updated
    })
  }, [])

  if (events.length === 0) {
    return (
      <div className="space-y-4">
        <AddEventForm onEventAdded={handleEventAdded} />
        <div className="empty-state">
          <History className="empty-state__icon" strokeWidth={1.5} aria-hidden="true" />
          <p className="empty-state__title">Your timeline is waiting for its first event</p>
          <p className="empty-state__hint">
            Use the button above to add a diagnosis, test, or appointment.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Add Event */}
      <AddEventForm onEventAdded={handleEventAdded} />

      {/* Filter chips */}
      <div
        className="flex gap-2 overflow-x-auto hide-scrollbar pb-3"
        role="group"
        aria-label="Filter timeline"
      >
        {filterChips.map((chip) => {
          const isActive = filter === chip.id
          return (
            <button
              key={chip.id}
              onClick={() => setFilter(chip.id)}
              className="touch-target press-feedback rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap"
              style={{
                background: isActive ? 'var(--accent-sage-muted)' : 'var(--bg-elevated)',
                color: isActive ? 'var(--accent-sage)' : 'var(--text-secondary)',
                border: isActive ? '1px solid rgba(107, 144, 128, 0.2)' : '1px solid transparent',
                transition: `background var(--duration-fast) var(--ease-standard)`,
              }}
              aria-pressed={isActive}
            >
              {chip.label}
            </button>
          )
        })}
      </div>

      {/* Filtered-but-empty */}
      {filtered.length === 0 && (
        <div className="empty-state">
          <History className="empty-state__icon" strokeWidth={1.5} aria-hidden="true" />
          <p className="empty-state__title">No events match this filter</p>
          <p className="empty-state__hint">
            Try switching to &quot;All&quot; to see everything on your timeline.
          </p>
        </div>
      )}

      {/* Timeline */}
      {filtered.length > 0 && (
        <div className="relative ml-4 mt-2">
          {/* Vertical line */}
          <div
            className="absolute left-0 top-0 bottom-0 w-0.5"
            style={{ background: 'var(--border)' }}
          />

          {filtered.map((event, idx) => {
            const color = eventColor(event.event_type)
            const isExpanded = expandedId === event.id
            const sigBadge = significanceBadge(event.significance)
            const isLast = idx === filtered.length - 1

            return (
              <div key={event.id} className={`relative pl-6 ${isLast ? '' : 'pb-6'}`}>
                {/* Dot */}
                <div
                  className="absolute left-0 -translate-x-1/2 w-3 h-3 rounded-full border-2"
                  style={{
                    background: color,
                    borderColor: 'var(--bg-primary)',
                    top: '4px',
                  }}
                />

                <button
                  onClick={() => toggle(event.id)}
                  className="press-feedback w-full text-left"
                  aria-expanded={isExpanded}
                >
                  {/* Date + type badge */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="tabular text-xs" style={{ color: 'var(--text-muted)' }}>
                      {formatDate(event.event_date)}
                    </span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: `${color}1A`, color }}
                    >
                      {eventTypeLabel(event.event_type)}
                    </span>
                    {sigBadge && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: sigBadge.bg, color: sigBadge.color }}
                      >
                        {sigBadge.label}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-primary)' }}>
                    {event.title}
                  </p>

                  {/* Expanded: description */}
                  {isExpanded && event.description && (
                    <div
                      className="mt-2 rounded-lg p-3"
                      style={{ background: 'var(--bg-elevated)' }}
                    >
                      <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                        {event.description}
                      </p>
                    </div>
                  )}

                  {/* Expanded: linked data */}
                  {isExpanded && event.linked_data && Object.keys(event.linked_data).length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                        Linked data
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {Object.entries(event.linked_data).map(([key, val]) => (
                          <span
                            key={key}
                            className="tabular text-xs px-2 py-0.5 rounded-full"
                            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
                          >
                            {key}: {String(val)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
