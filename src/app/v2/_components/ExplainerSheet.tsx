'use client'

/**
 * ExplainerSheet
 *
 * The Oura "Sleep regularity" / "Body temperature" educational modal
 * pattern (frame_0098, frame_0099, frame_0100), reused across home
 * metrics, sleep contributors, cycle phases, and timeline events.
 *
 * Always renders on the NC cream explanatory palette because
 * educational surfaces are the one place we trade the dark chrome
 * for warm legibility. See tokens.css .v2-surface-explanatory.
 *
 * Usage shapes:
 *
 *   Simple (existing callers, no band):
 *     <ExplainerSheet open={open} onClose={...} title="Sleep score">
 *       <p>What Oura measures...</p>
 *     </ExplainerSheet>
 *
 *   Oura-style with range bands (home metric explainers):
 *     <ExplainerSheet
 *       open={open}
 *       onClose={...}
 *       title="Readiness"
 *       bands={[...]}
 *       currentValue={78}
 *       source="Based on last night's sleep and HRV."
 *     >
 *       <p>...</p>
 *     </ExplainerSheet>
 *
 * Children are free-form React nodes so callers can embed lists,
 * emphasis, or a "Learn more" Button without constraint.
 */
import type { ReactNode } from 'react'
import { Button, Sheet } from '@/v2/components/primitives'

export interface ExplainerBand {
  /** Label shown under the band segment (e.g. "Optimal"). */
  label: string
  /** Inclusive lower bound for this band on the metric scale. */
  min: number
  /** Inclusive upper bound for this band on the metric scale. */
  max: number
  /** Color for the segment. Use a v2 accent token. */
  color: string
}

export interface ExplainerSheetProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  /**
   * Ordered threshold bands to render as a single segmented bar at
   * the top of the sheet. Ordered low to high; gaps are fine.
   */
  bands?: ExplainerBand[]
  /** The user's current value, plotted as a tick over the band bar. */
  currentValue?: number | null
  /** Plain-language note about how the value was derived. */
  source?: ReactNode
  /** Short band label matching the current value (e.g. "Good"). */
  currentBandLabel?: string
  /** Override the default "Got it" dismiss copy. */
  dismissLabel?: string
}

function clampToRange(value: number, min: number, max: number): number {
  if (max <= min) return 0
  if (value <= min) return 0
  if (value >= max) return 1
  return (value - min) / (max - min)
}

function BandBar({
  bands,
  currentValue,
  currentBandLabel,
}: {
  bands: ExplainerBand[]
  currentValue: number | null | undefined
  currentBandLabel?: string
}) {
  const scaleMin = Math.min(...bands.map((b) => b.min))
  const scaleMax = Math.max(...bands.map((b) => b.max))
  const hasValue = typeof currentValue === 'number' && Number.isFinite(currentValue)
  const tickPct = hasValue ? clampToRange(currentValue as number, scaleMin, scaleMax) * 100 : null

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-2)',
        paddingBottom: 'var(--v2-space-3)',
        marginBottom: 'var(--v2-space-3)',
        borderBottom: '1px solid var(--v2-surface-explanatory-border)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          fontSize: 'var(--v2-text-xs)',
          color: 'var(--v2-surface-explanatory-muted)',
          letterSpacing: 'var(--v2-tracking-wide)',
          textTransform: 'uppercase',
        }}
      >
        <span>
          {hasValue ? (
            <span style={{ color: 'var(--v2-surface-explanatory-text)', fontWeight: 'var(--v2-weight-semibold)' }}>
              {currentValue}
            </span>
          ) : (
            <span>No data</span>
          )}
        </span>
        {currentBandLabel && (
          <span style={{ color: 'var(--v2-surface-explanatory-text)', fontWeight: 'var(--v2-weight-semibold)' }}>
            {currentBandLabel}
          </span>
        )}
      </div>

      <div style={{ position: 'relative', height: 8 }}>
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            borderRadius: 'var(--v2-radius-full)',
            overflow: 'hidden',
            gap: 2,
          }}
        >
          {bands.map((band) => {
            const width = ((band.max - band.min) / (scaleMax - scaleMin)) * 100
            return (
              <span
                key={band.label}
                style={{
                  flex: `0 0 calc(${width}% - 2px)`,
                  background: band.color,
                  opacity: 0.85,
                }}
                aria-hidden="true"
              />
            )
          })}
        </div>
        {tickPct !== null && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: -3,
              left: `calc(${tickPct}% - 7px)`,
              width: 14,
              height: 14,
              borderRadius: 'var(--v2-radius-full)',
              background: 'var(--v2-surface-explanatory-text)',
              border: '2px solid var(--v2-surface-explanatory-bg)',
              boxShadow: 'var(--v2-shadow-explanatory-sm)',
            }}
          />
        )}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 'var(--v2-space-2)',
          fontSize: 'var(--v2-text-xs)',
          color: 'var(--v2-surface-explanatory-muted)',
        }}
      >
        {bands.map((band) => (
          <span key={band.label} style={{ flex: 1, textAlign: 'center' }}>
            {band.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function ExplainerSheet({
  open,
  onClose,
  title,
  children,
  bands,
  currentValue,
  currentBandLabel,
  source,
  dismissLabel = 'Got it',
}: ExplainerSheetProps) {
  const showBands = Array.isArray(bands) && bands.length > 0
  const showDismiss = showBands || source != null
  return (
    <Sheet open={open} onClose={onClose} explanatory title={title}>
      {showBands && bands && (
        <BandBar bands={bands} currentValue={currentValue} currentBandLabel={currentBandLabel} />
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-3)',
          fontSize: 'var(--v2-text-sm)',
          lineHeight: 'var(--v2-leading-relaxed)',
          color: 'var(--v2-surface-explanatory-text)',
        }}
      >
        {children}
      </div>

      {source != null && (
        <div
          style={{
            marginTop: 'var(--v2-space-4)',
            padding: 'var(--v2-space-3)',
            borderRadius: 'var(--v2-radius-md)',
            background: 'var(--v2-surface-explanatory-card)',
            border: '1px solid var(--v2-surface-explanatory-border)',
            fontSize: 'var(--v2-text-xs)',
            lineHeight: 'var(--v2-leading-normal)',
            color: 'var(--v2-surface-explanatory-muted)',
          }}
        >
          {source}
        </div>
      )}

      {showDismiss && (
        <div style={{ marginTop: 'var(--v2-space-5)', display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="secondary"
            onClick={onClose}
            style={{
              background: 'var(--v2-surface-explanatory-cta)',
              color: '#FFFFFF',
              border: '1px solid var(--v2-surface-explanatory-cta)',
            }}
          >
            {dismissLabel}
          </Button>
        </div>
      )}
    </Sheet>
  )
}
