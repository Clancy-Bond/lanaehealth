'use client'

import { Card } from '@/v2/components/primitives'
import DoctorPanelHeader from './DoctorPanelHeader'
import { useTalkingPoints, type TalkingPoint } from './useTalkingPoints'
import type { DoctorPageData } from '@/app/doctor/page'
import type { SpecialistView } from '@/lib/doctor/specialist-config'

interface TalkingPointsCardProps {
  data: DoctorPageData
  view: SpecialistView
}

function groupOf(p: TalkingPoint): 'lab' | 'concern' | 'other' {
  if (p.prefix.includes('trend') || p.prefix.includes('flagged')) return 'lab'
  if (p.prefix === 'Active concern' || p.prefix === 'Suspected') return 'concern'
  return 'other'
}

function PointRow({ point }: { point: TalkingPoint }) {
  const dotColor = point.priority <= 1 ? 'var(--v2-accent-danger)' : 'var(--v2-accent-success)'
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--v2-space-3)',
        padding: 'var(--v2-space-2) 0',
        fontSize: 'var(--v2-text-sm)',
        lineHeight: 'var(--v2-leading-relaxed)',
        color: 'var(--v2-text-secondary)',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: dotColor,
          flexShrink: 0,
          marginTop: 7,
        }}
      />
      <span>
        <strong style={{ color: 'var(--v2-text-primary)', fontWeight: 'var(--v2-weight-semibold)' }}>
          {point.prefix}:
        </strong>{' '}
        {point.detail}
      </span>
    </div>
  )
}

function GroupLabel({ children }: { children: string }) {
  return (
    <p
      style={{
        margin: 'var(--v2-space-2) 0 2px',
        fontSize: 'var(--v2-text-xs)',
        fontWeight: 'var(--v2-weight-semibold)',
        textTransform: 'uppercase',
        letterSpacing: 'var(--v2-tracking-wide)',
        color: 'var(--v2-text-muted)',
      }}
    >
      {children}
    </p>
  )
}

/*
 * TalkingPointsCard
 *
 * The single most important card on the page. A doctor who reads
 * only this card should still know the three things that matter
 * most today. Points are pre-ranked by useTalkingPoints; this card
 * just groups them into Lab / Concern / Other sections for
 * scanability and renders them as dotted rows.
 */
export default function TalkingPointsCard({ data, view }: TalkingPointsCardProps) {
  const points = useTalkingPoints(data, view)
  if (points.length === 0) return null

  const labs = points.filter((p) => groupOf(p) === 'lab')
  const concerns = points.filter((p) => groupOf(p) === 'concern')
  const other = points.filter((p) => groupOf(p) === 'other')

  const topPriority = Math.min(...points.map((p) => p.priority))
  const summary =
    topPriority <= 1
      ? `${points.length} points; start with the highlighted ones`
      : `${points.length} key ${points.length === 1 ? 'point' : 'points'} from this visit`

  return (
    <Card padding="md">
      <DoctorPanelHeader title="What to tell the doctor" summary={summary} />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {labs.length > 0 && (
          <div>
            <GroupLabel>Lab trends</GroupLabel>
            {labs.map((p, i) => (
              <PointRow key={`lab-${i}`} point={p} />
            ))}
          </div>
        )}
        {concerns.length > 0 && (
          <div>
            <GroupLabel>Active concerns</GroupLabel>
            {concerns.map((p, i) => (
              <PointRow key={`concern-${i}`} point={p} />
            ))}
          </div>
        )}
        {other.length > 0 && (
          <div>
            <GroupLabel>Other findings</GroupLabel>
            {other.map((p, i) => (
              <PointRow key={`other-${i}`} point={p} />
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
