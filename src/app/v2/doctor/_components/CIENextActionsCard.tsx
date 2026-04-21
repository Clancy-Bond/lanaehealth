import { Card } from '@/v2/components/primitives'
import DoctorPanelHeader from './DoctorPanelHeader'
import type { KBActionsPayload, KBAction, ActionUrgency } from '@/lib/doctor/kb-actions'
import type { SpecialistView } from '@/lib/doctor/specialist-config'

interface CIENextActionsCardProps {
  payload: KBActionsPayload | null
  view: SpecialistView
}

function urgencyColor(u: ActionUrgency): string {
  if (u === 'Urgent') return 'var(--v2-accent-danger)'
  if (u === 'Soon') return 'var(--v2-accent-warning)'
  if (u === 'Routine') return 'var(--v2-accent-primary)'
  return 'var(--v2-text-muted)'
}

function filterActionsForView(actions: KBAction[], view: SpecialistView): KBAction[] {
  // Cardiology view: demote purely reproductive actions
  if (view === 'cardiology') {
    return actions.filter(
      (a) => !/endometri|ovarian|pelvic|menstrual/i.test(a.title + a.rationale),
    )
  }
  // OB/GYN view: demote autonomic-only actions
  if (view === 'obgyn') {
    return actions.filter((a) => !/pots|orthostatic|autonomic/i.test(a.title + a.rationale))
  }
  return actions
}

/*
 * CIENextActionsCard
 *
 * "Clinical Intelligence Engine" next actions are the ranked
 * investigations most likely to move a hypothesis score. Think of
 * this as the bet sizing: "doing X swings chiari +/-35 points,
 * doing Y swings endo +8 points." Doctor-facing version is the
 * question list they walk out of the visit with.
 */
export default function CIENextActionsCard({ payload, view }: CIENextActionsCardProps) {
  if (!payload || payload.actions.length === 0) return null
  const actions = filterActionsForView(payload.actions, view).slice(0, 5)
  if (actions.length === 0) return null
  const urgent = actions.filter((a) => a.urgency === 'Urgent').length
  const summary =
    urgent > 0
      ? `${urgent} urgent action${urgent === 1 ? '' : 's'} queued`
      : `${actions.length} suggested action${actions.length === 1 ? '' : 's'}`

  return (
    <Card padding="md">
      <DoctorPanelHeader
        title="Recommended next actions"
        summary={summary}
        trailing={
          payload.stale ? (
            <span
              style={{
                fontSize: 'var(--v2-text-xs)',
                color: 'var(--v2-text-muted)',
                fontStyle: 'italic',
              }}
            >
              stale
            </span>
          ) : undefined
        }
      />
      <ol
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-3)',
        }}
      >
        {actions.map((a) => (
          <li
            key={`${a.rank}-${a.title}`}
            style={{
              padding: 'var(--v2-space-3)',
              borderRadius: 'var(--v2-radius-sm)',
              background: 'var(--v2-bg-elevated)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--v2-space-2)' }}>
              <span
                style={{
                  fontSize: 'var(--v2-text-sm)',
                  fontWeight: 'var(--v2-weight-semibold)',
                  color: 'var(--v2-text-primary)',
                }}
              >
                {a.rank}. {a.title}
              </span>
              <span
                style={{
                  fontSize: 'var(--v2-text-xs)',
                  color: urgencyColor(a.urgency),
                  fontWeight: 'var(--v2-weight-semibold)',
                  whiteSpace: 'nowrap',
                }}
              >
                {a.urgency}
              </span>
            </div>
            <div
              style={{
                fontSize: 'var(--v2-text-xs)',
                color: 'var(--v2-text-muted)',
                marginTop: 2,
              }}
            >
              Swing: {a.potentialSwing} · Difficulty: {a.difficulty}
              {a.affects.length > 0 && ` · Affects: ${a.affects.join(', ')}`}
            </div>
            <p
              style={{
                margin: 'var(--v2-space-2) 0 0 0',
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-text-secondary)',
                lineHeight: 'var(--v2-leading-normal)',
              }}
            >
              {a.rationale}
            </p>
          </li>
        ))}
      </ol>
    </Card>
  )
}
