'use client'

import { useState } from 'react'
import { Card, Button } from '@/v2/components/primitives'
import DoctorPanelHeader from './DoctorPanelHeader'
import type { ChallengerPayload } from '@/lib/doctor/kb-challenger'

interface ChallengerCardProps {
  payload: ChallengerPayload | null
}

function BulletList({ items, title }: { items: string[]; title: string }) {
  if (items.length === 0) return null
  return (
    <div style={{ marginTop: 'var(--v2-space-3)' }}>
      <h4
        style={{
          margin: '0 0 var(--v2-space-2) 0',
          fontSize: 'var(--v2-text-xs)',
          fontWeight: 'var(--v2-weight-semibold)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--v2-tracking-wide)',
          color: 'var(--v2-text-muted)',
        }}
      >
        {title}
      </h4>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-1)' }}>
        {items.map((b, i) => (
          <li key={i} style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-secondary)', lineHeight: 'var(--v2-leading-relaxed)' }}>
            · {b}
          </li>
        ))}
      </ul>
    </div>
  )
}

/*
 * ChallengerCard
 *
 * The "what if we're wrong" panel. An adversarial KB persona picks
 * apart the leading hypotheses and surfaces stagnation, echo-chamber,
 * and missing-differential warnings. Keeps a doctor honest when the
 * story is starting to feel too settled.
 *
 * Primary attacks are always visible (non-negotiable clinical data).
 * Secondary warnings (stagnation / echo / missing) expand on demand
 * so they don't dominate the primary brief.
 */
export default function ChallengerCard({ payload }: ChallengerCardProps) {
  const [expanded, setExpanded] = useState(false)
  if (!payload) return null
  const { challenges, stagnation, echoCheck, missingDiagnoses, stale } = payload
  const secondaryCount = stagnation.length + echoCheck.length + missingDiagnoses.length
  if (challenges.length === 0 && secondaryCount === 0) return null

  const summary =
    challenges.length > 0
      ? `${challenges.length} challenge${challenges.length === 1 ? '' : 's'} to current hypotheses`
      : `${secondaryCount} adversarial warning${secondaryCount === 1 ? '' : 's'}`

  return (
    <Card padding="md">
      <DoctorPanelHeader
        title="Challenger view"
        summary={summary}
        trailing={
          stale ? (
            <span style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)', fontStyle: 'italic' }}>stale</span>
          ) : undefined
        }
      />
      {challenges.length > 0 && (
        <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
          {challenges.map((c, i) => (
            <li
              key={i}
              style={{
                padding: 'var(--v2-space-3)',
                borderRadius: 'var(--v2-radius-sm)',
                background: 'rgba(217, 119, 92, 0.08)',
                border: '1px solid rgba(217, 119, 92, 0.35)',
              }}
            >
              {c.targetHypothesis && (
                <div
                  style={{
                    fontSize: 'var(--v2-text-sm)',
                    fontWeight: 'var(--v2-weight-semibold)',
                    color: 'var(--v2-text-primary)',
                    marginBottom: 2,
                  }}
                >
                  Target: {c.targetHypothesis}
                  {c.targetConfidence && ` (${c.targetConfidence})`}
                </div>
              )}
              <p
                style={{
                  margin: 0,
                  fontSize: 'var(--v2-text-sm)',
                  color: 'var(--v2-text-secondary)',
                  lineHeight: 'var(--v2-leading-relaxed)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {c.body}
              </p>
            </li>
          ))}
        </ol>
      )}
      {expanded && (
        <>
          <BulletList items={stagnation} title="Signs of stagnation" />
          <BulletList items={echoCheck} title="Echo-chamber check" />
          <BulletList items={missingDiagnoses} title="Missing diagnoses worth considering" />
        </>
      )}
      {secondaryCount > 0 && (
        <div style={{ marginTop: 'var(--v2-space-3)' }}>
          <Button variant="tertiary" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Show less' : `Show ${secondaryCount} more`}
          </Button>
        </div>
      )}
    </Card>
  )
}
