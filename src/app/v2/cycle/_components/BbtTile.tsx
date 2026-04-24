'use client'

import { useState } from 'react'
import { Card, Sheet, Button } from '@/v2/components/primitives'
import BbtLogSheetBody from './BbtLogSheetBody'
import type { BbtEntry } from '@/lib/cycle/bbt-log'
import { BbtExplainer } from './MetricExplainers'

export interface BbtTileProps {
  date: string
  latest: BbtEntry | null
  confirmedOvulation: boolean
}

export default function BbtTile({ date, latest, confirmedOvulation }: BbtTileProps) {
  const [open, setOpen] = useState(false)
  const [explainerOpen, setExplainerOpen] = useState(false)

  const tempDisplay = latest
    ? `${latest.temp_f.toFixed(2)}°F`
    : '--'
  const subtitle = latest
    ? confirmedOvulation
      ? 'Sustained rise detected'
      : 'Last logged'
    : 'No reading yet'

  return (
    <Card padding="md">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--v2-space-3)' }}>
        <button
          type="button"
          aria-label="Open basal temperature explainer"
          onClick={() => setExplainerOpen(true)}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-1)',
            background: 'transparent',
            border: 'none',
            padding: 0,
            margin: 0,
            cursor: 'pointer',
            color: 'inherit',
            textAlign: 'left',
            font: 'inherit',
          }}
        >
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--v2-tracking-wide)',
            }}
          >
            Basal temp
          </span>
          <span
            style={{
              fontSize: 'var(--v2-text-2xl)',
              fontWeight: 'var(--v2-weight-bold)',
              color: confirmedOvulation ? 'var(--v2-accent-success)' : 'var(--v2-text-primary)',
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: 'var(--v2-tracking-tight)',
              lineHeight: 1.1,
            }}
          >
            {tempDisplay}
          </span>
          <span style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-muted)' }}>
            {subtitle}
          </span>
        </button>
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          Log temp
        </Button>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title="Log basal temperature">
        <BbtLogSheetBody date={date} onDone={() => setOpen(false)} />
      </Sheet>
      <BbtExplainer
        open={explainerOpen}
        onClose={() => setExplainerOpen(false)}
        tempF={latest?.temp_f}
        confirmedOvulation={confirmedOvulation}
        measuredAtISO={latest?.date ?? null}
      />
    </Card>
  )
}
