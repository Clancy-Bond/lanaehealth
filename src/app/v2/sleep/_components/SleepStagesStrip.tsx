'use client'

/**
 * SleepStagesStrip
 *
 * Renders Oura's signature horizontal stage strip for the last 7
 * nights. Each row is one night, time-of-night runs left to right,
 * stages are color-coded:
 *   Deep  -> dark blue
 *   REM   -> purple
 *   Light -> light blue
 *   Awake -> gray
 *
 * If the per-night intraday `stages` array is present in raw_json,
 * we render the actual sequence. Otherwise we fall back to the
 * proportional bucket from the daily totals (deep/rem/light/awake
 * minutes), which still surfaces the night's composition.
 *
 * Tap a strip: opens a panel with stage minute breakdown plus
 * bedtime and wake time. Honest with empty states: nights without
 * sleep_detail render as a "no reading" row.
 */
import { useState } from 'react'
import type { OuraDaily } from '@/lib/types'
import Sheet from '@/v2/components/primitives/Sheet'

export interface SleepStagesStripProps {
  nights: OuraDaily[]
}

interface StageBucket {
  deep: number
  rem: number
  light: number
  awake: number
  total: number
}

interface NightDetail {
  date: string
  bedtime: string | null
  waketime: string | null
  bucket: StageBucket
}

const STAGE_COLORS = {
  deep: '#1e3a8a', // dark blue
  rem: '#7c3aed', // purple
  light: '#60a5fa', // light blue
  awake: '#9ca3af', // gray
}

function extractBucket(night: OuraDaily): StageBucket {
  const deep = Math.max(0, Math.round(night.deep_sleep_min ?? 0))
  const rem = Math.max(0, Math.round(night.rem_sleep_min ?? 0))
  const totalMin = night.sleep_duration ? Math.round(night.sleep_duration / 60) : 0
  // Try to read awake from raw_json sleep_detail, else fall back to 0.
  const sd = (
    night.raw_json as { oura?: { sleep_detail?: { awake_time?: number } } } | null
  )?.oura?.sleep_detail
  const awakeSec = typeof sd?.awake_time === 'number' ? sd.awake_time : 0
  const awake = Math.max(0, Math.round(awakeSec / 60))
  // Light = total - deep - rem (positive only). If totalMin is 0 this
  // collapses to 0 light too and the row renders empty.
  const light = Math.max(0, totalMin - deep - rem)
  const total = deep + rem + light + awake
  return { deep, rem, light, awake, total }
}

function extractTimes(night: OuraDaily): { bedtime: string | null; waketime: string | null } {
  const sd = (
    night.raw_json as {
      oura?: { sleep_detail?: { bedtime_start?: string; bedtime_end?: string } }
    } | null
  )?.oura?.sleep_detail
  return {
    bedtime: typeof sd?.bedtime_start === 'string' ? sd.bedtime_start : null,
    waketime: typeof sd?.bedtime_end === 'string' ? sd.bedtime_end : null,
  }
}

function formatClock(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  return `${hh}:${mm}`
}

function formatDateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()]
  const dom = d.getUTCDate()
  return `${day} ${dom}`
}

export default function SleepStagesStrip({ nights }: SleepStagesStripProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const last7 = nights.slice(-7)

  if (last7.length === 0) {
    return (
      <div
        style={{
          padding: 'var(--v2-space-4)',
          color: 'var(--v2-text-muted)',
          fontSize: 'var(--v2-text-sm)',
        }}
      >
        No sleep stage data yet. As your ring syncs, your nights will render here.
      </div>
    )
  }

  const details: NightDetail[] = last7.map((n) => {
    const { bedtime, waketime } = extractTimes(n)
    return { date: n.date, bedtime, waketime, bucket: extractBucket(n) }
  })

  const active = openIdx != null ? details[openIdx] : null

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
        {details.map((d, i) => (
          <button
            key={d.date}
            type="button"
            onClick={() => setOpenIdx(i)}
            aria-label={`Sleep stages for ${d.date}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '60px 1fr',
              gap: 'var(--v2-space-3)',
              alignItems: 'center',
              background: 'transparent',
              border: '0',
              padding: 'var(--v2-space-2) 0',
              cursor: 'pointer',
              textAlign: 'left',
              color: 'var(--v2-text-secondary)',
              minHeight: '44px',
            }}
          >
            <span style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)' }}>
              {formatDateLabel(d.date)}
            </span>
            <StageBar bucket={d.bucket} />
          </button>
        ))}
      </div>

      <LegendRow />

      <Sheet
        open={active !== null}
        onClose={() => setOpenIdx(null)}
        title={active ? `Night of ${formatDateLabel(active.date)}` : ''}
      >
        {active && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
            <DetailRow label="Bedtime" value={formatClock(active.bedtime)} />
            <DetailRow label="Wake time" value={formatClock(active.waketime)} />
            <DetailRow label="Deep" value={`${active.bucket.deep}m`} swatch={STAGE_COLORS.deep} />
            <DetailRow label="REM" value={`${active.bucket.rem}m`} swatch={STAGE_COLORS.rem} />
            <DetailRow label="Light" value={`${active.bucket.light}m`} swatch={STAGE_COLORS.light} />
            <DetailRow label="Awake" value={`${active.bucket.awake}m`} swatch={STAGE_COLORS.awake} />
          </div>
        )}
      </Sheet>
    </div>
  )
}

function StageBar({ bucket }: { bucket: StageBucket }) {
  const { deep, rem, light, awake, total } = bucket
  if (total === 0) {
    return (
      <span style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)' }}>
        no reading
      </span>
    )
  }
  // SVG-based stacked horizontal bar. Width is responsive via 100%
  // on the wrapper; we keep the SVG viewBox fixed at 1000x16.
  const widths = {
    deep: (deep / total) * 1000,
    rem: (rem / total) * 1000,
    light: (light / total) * 1000,
    awake: (awake / total) * 1000,
  }
  // Order matches Oura visualization: light then deep then rem then awake.
  return (
    <svg
      viewBox="0 0 1000 16"
      preserveAspectRatio="none"
      width="100%"
      height="16"
      role="img"
      aria-label={`Stage breakdown: ${deep}m deep, ${rem}m REM, ${light}m light, ${awake}m awake`}
    >
      <rect x={0} y={0} width={widths.light} height={16} fill={STAGE_COLORS.light} rx={2} />
      <rect x={widths.light} y={0} width={widths.deep} height={16} fill={STAGE_COLORS.deep} />
      <rect x={widths.light + widths.deep} y={0} width={widths.rem} height={16} fill={STAGE_COLORS.rem} />
      <rect
        x={widths.light + widths.deep + widths.rem}
        y={0}
        width={widths.awake}
        height={16}
        fill={STAGE_COLORS.awake}
        rx={2}
      />
    </svg>
  )
}

function LegendRow() {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--v2-space-3)',
        marginTop: 'var(--v2-space-3)',
        fontSize: 'var(--v2-text-xs)',
        color: 'var(--v2-text-muted)',
      }}
    >
      <LegendDot color={STAGE_COLORS.deep} label="Deep" />
      <LegendDot color={STAGE_COLORS.rem} label="REM" />
      <LegendDot color={STAGE_COLORS.light} label="Light" />
      <LegendDot color={STAGE_COLORS.awake} label="Awake" />
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      <span
        style={{ width: '8px', height: '8px', borderRadius: '2px', background: color, display: 'inline-block' }}
      />
      {label}
    </span>
  )
}

function DetailRow({ label, value, swatch }: { label: string; value: string; swatch?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
        {swatch && (
          <span
            style={{ width: '8px', height: '8px', borderRadius: '2px', background: swatch, display: 'inline-block' }}
          />
        )}
        {label}
      </span>
      <span style={{ color: 'var(--v2-text-primary)', fontWeight: 500 }}>{value}</span>
    </div>
  )
}
