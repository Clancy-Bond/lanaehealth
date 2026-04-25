'use client'

import { useEffect, useState } from 'react'
import { Card, Button, Skeleton } from '@/v2/components/primitives'
import DoctorPanelHeader from './DoctorPanelHeader'
import type { SpecialistView } from '@/lib/doctor/specialist-config'

interface WeeklyNarrativeCardProps {
  view: SpecialistView
}

interface NarrativePayload {
  content: string | null
  generatedAt: string | null
  stale: boolean
  view?: SpecialistView
  error?: string
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/*
 * WeeklyNarrativeCard
 *
 * A 200-word plain-prose summary of the week from the narrative
 * generator. This is the "one paragraph your doctor can read while
 * washing their hands" surface. Hits /api/narrative/weekly?view=...
 * on mount; regenerate is a POST to the same endpoint.
 */
export default function WeeklyNarrativeCard({ view }: WeeklyNarrativeCardProps) {
  const [state, setState] = useState<NarrativePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/narrative/weekly?view=${view}`)
      .then((r) => r.json())
      .then((d: NarrativePayload) => {
        if (!cancelled) setState(d)
      })
      .catch(() => {
        if (!cancelled) setState({ content: null, generatedAt: null, stale: true })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [view])

  const handleRegenerate = async () => {
    setRegenerating(true)
    try {
      const res = await fetch(`/api/narrative/weekly?view=${view}`, { method: 'POST' })
      const data = (await res.json()) as NarrativePayload
      setState(data)
    } catch {
      // stale state remains
    } finally {
      setRegenerating(false)
    }
  }

  const hasContent = state?.content != null && state.content.length > 0
  const summary = hasContent
    ? `${view.toUpperCase()} variant ready${state!.stale ? ' · may be stale' : ''}`
    : loading
      ? 'Pulling narrative...'
      : 'No narrative generated yet'

  return (
    <Card padding="md">
      <DoctorPanelHeader
        title="Health story"
        summary={summary}
        trailing={
          <Button variant="tertiary" size="sm" onClick={handleRegenerate} disabled={regenerating || loading}>
            {regenerating ? 'Regenerating' : hasContent ? 'Refresh' : 'Generate'}
          </Button>
        }
      />
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
          <Skeleton shape="text" width="92%" />
          <Skeleton shape="text" width="78%" />
          <Skeleton shape="text" width="85%" />
        </div>
      ) : hasContent ? (
        <>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            {state!.content}
          </p>
          {state!.generatedAt && (
            <p
              style={{
                margin: 'var(--v2-space-2) 0 0 0',
                fontSize: 'var(--v2-text-xs)',
                color: 'var(--v2-text-muted)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              Generated {formatTime(state!.generatedAt)}
              {state!.stale ? ' (stale, consider refreshing)' : ''}
            </p>
          )}
        </>
      ) : (
        <p
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-muted)',
            fontStyle: 'italic',
          }}
        >
          Your health story appears here once generated. Tap Generate for a 200-word summary.
        </p>
      )}
    </Card>
  )
}
