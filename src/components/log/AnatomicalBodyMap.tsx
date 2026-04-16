'use client'

/**
 * Anatomical Body Map with precise pin placement
 *
 * Shows front and back silhouettes of the body. User taps to drop a pin.
 * Each pin has intensity (0-10), pain type, and body region auto-detected.
 *
 * Exceeds Bearable's grid approach by allowing precise anatomical placement.
 * Used in:
 * - Daily log pain section
 * - Endometriosis mode expanded tracking
 * - Doctor reports (pinpoints specific anatomical regions)
 */

import { useState, useCallback, useRef } from 'react'
import type { PainPoint, PainType } from '@/lib/types'
import { addPainPoint, deletePainPoint } from '@/lib/api/logs'
import SaveIndicator from './SaveIndicator'

interface AnatomicalBodyMapProps {
  logId: string
  initialPainPoints: PainPoint[]
  onCountChange: (count: number) => void
}

// Normalized SVG coordinate regions (0-100 x/y) for region detection
interface AnatomicalRegion {
  id: string
  label: string
  view: 'front' | 'back'
  bounds: { x: number; y: number; width: number; height: number }
}

const REGIONS: AnatomicalRegion[] = [
  // Front view
  { id: 'head-f', label: 'Head (front)', view: 'front', bounds: { x: 35, y: 2, width: 30, height: 14 } },
  { id: 'neck-f', label: 'Neck', view: 'front', bounds: { x: 42, y: 16, width: 16, height: 5 } },
  { id: 'chest', label: 'Chest', view: 'front', bounds: { x: 30, y: 21, width: 40, height: 12 } },
  { id: 'upper-abdomen', label: 'Upper abdomen', view: 'front', bounds: { x: 33, y: 33, width: 34, height: 10 } },
  { id: 'lower-abdomen', label: 'Lower abdomen / Pelvis', view: 'front', bounds: { x: 33, y: 43, width: 34, height: 12 } },
  { id: 'left-shoulder-f', label: 'Left shoulder', view: 'front', bounds: { x: 18, y: 21, width: 12, height: 8 } },
  { id: 'right-shoulder-f', label: 'Right shoulder', view: 'front', bounds: { x: 70, y: 21, width: 12, height: 8 } },
  { id: 'left-arm-f', label: 'Left arm', view: 'front', bounds: { x: 14, y: 29, width: 14, height: 24 } },
  { id: 'right-arm-f', label: 'Right arm', view: 'front', bounds: { x: 72, y: 29, width: 14, height: 24 } },
  { id: 'left-hip-f', label: 'Left hip', view: 'front', bounds: { x: 30, y: 55, width: 16, height: 8 } },
  { id: 'right-hip-f', label: 'Right hip', view: 'front', bounds: { x: 54, y: 55, width: 16, height: 8 } },
  { id: 'left-thigh-f', label: 'Left thigh', view: 'front', bounds: { x: 32, y: 63, width: 16, height: 15 } },
  { id: 'right-thigh-f', label: 'Right thigh', view: 'front', bounds: { x: 52, y: 63, width: 16, height: 15 } },
  { id: 'left-knee-f', label: 'Left knee', view: 'front', bounds: { x: 33, y: 78, width: 14, height: 6 } },
  { id: 'right-knee-f', label: 'Right knee', view: 'front', bounds: { x: 53, y: 78, width: 14, height: 6 } },
  { id: 'left-shin', label: 'Left shin', view: 'front', bounds: { x: 34, y: 84, width: 12, height: 12 } },
  { id: 'right-shin', label: 'Right shin', view: 'front', bounds: { x: 54, y: 84, width: 12, height: 12 } },
  { id: 'left-foot-f', label: 'Left foot', view: 'front', bounds: { x: 32, y: 96, width: 14, height: 4 } },
  { id: 'right-foot-f', label: 'Right foot', view: 'front', bounds: { x: 54, y: 96, width: 14, height: 4 } },
  // Back view
  { id: 'head-b', label: 'Head (back)', view: 'back', bounds: { x: 35, y: 2, width: 30, height: 14 } },
  { id: 'upper-back', label: 'Upper back', view: 'back', bounds: { x: 30, y: 21, width: 40, height: 12 } },
  { id: 'mid-back', label: 'Mid back', view: 'back', bounds: { x: 33, y: 33, width: 34, height: 10 } },
  { id: 'lower-back', label: 'Lower back', view: 'back', bounds: { x: 33, y: 43, width: 34, height: 12 } },
  { id: 'left-glute', label: 'Left glute', view: 'back', bounds: { x: 32, y: 55, width: 18, height: 9 } },
  { id: 'right-glute', label: 'Right glute', view: 'back', bounds: { x: 50, y: 55, width: 18, height: 9 } },
  { id: 'left-hamstring', label: 'Left hamstring', view: 'back', bounds: { x: 32, y: 64, width: 16, height: 14 } },
  { id: 'right-hamstring', label: 'Right hamstring', view: 'back', bounds: { x: 52, y: 64, width: 16, height: 14 } },
  { id: 'left-calf', label: 'Left calf', view: 'back', bounds: { x: 34, y: 84, width: 12, height: 12 } },
  { id: 'right-calf', label: 'Right calf', view: 'back', bounds: { x: 54, y: 84, width: 12, height: 12 } },
]

const PAIN_TYPES: { value: PainType; label: string }[] = [
  { value: 'aching', label: 'Aching' },
  { value: 'cramping', label: 'Cramping' },
  { value: 'sharp', label: 'Sharp' },
  { value: 'burning', label: 'Burning' },
  { value: 'pressure', label: 'Pressure' },
  { value: 'throbbing', label: 'Throbbing' },
  { value: 'stabbing', label: 'Stabbing' },
  { value: 'radiating', label: 'Radiating' },
]

function getPinColor(intensity: number): string {
  if (intensity <= 2) return '#B8D4D0'   // Sage mist
  if (intensity <= 4) return '#E8B5A6'   // Light blush
  if (intensity <= 6) return '#D4766B'   // Warm blush
  if (intensity <= 8) return '#B85450'   // Deep blush
  return '#8A2A27'                        // Crimson (extreme)
}

function getIntensityLabel(val: number): string {
  if (val <= 2) return 'Mild'
  if (val <= 4) return 'Noticeable'
  if (val <= 6) return 'Moderate'
  if (val <= 8) return 'Severe'
  return 'Extreme'
}

function detectRegion(x: number, y: number, view: 'front' | 'back'): AnatomicalRegion | null {
  for (const r of REGIONS) {
    if (r.view !== view) continue
    if (x >= r.bounds.x && x <= r.bounds.x + r.bounds.width &&
        y >= r.bounds.y && y <= r.bounds.y + r.bounds.height) {
      return r
    }
  }
  return null
}

// Body silhouette SVG paths (simplified human form)
const FRONT_BODY_PATH = `
  M50 4
  C46 4 43 7 43 11
  C43 14 45 17 47 18
  L47 22
  L38 23
  L28 25
  L22 29
  L18 34
  L16 40
  L15 48
  L16 52
  L18 53
  L20 48
  L22 44
  L25 41
  L28 40
  L28 55
  L30 63
  L32 78
  L33 84
  L33 96
  L34 100
  L46 100
  L46 96
  L46 84
  L47 78
  L48 73
  L48 63
  L50 63
  L52 63
  L52 73
  L53 78
  L54 84
  L54 96
  L54 100
  L66 100
  L67 96
  L67 84
  L67 78
  L68 63
  L70 55
  L72 40
  L75 41
  L78 44
  L80 48
  L82 53
  L84 52
  L85 48
  L84 40
  L82 34
  L78 29
  L72 25
  L62 23
  L53 22
  L53 18
  C55 17 57 14 57 11
  C57 7 54 4 50 4
  Z
`

const BACK_BODY_PATH = FRONT_BODY_PATH  // Same outline, different internal detail

export default function AnatomicalBodyMap({
  logId,
  initialPainPoints,
  onCountChange,
}: AnatomicalBodyMapProps) {
  const [painPoints, setPainPoints] = useState<PainPoint[]>(initialPainPoints)
  const [view, setView] = useState<'front' | 'back'>('front')
  const [pendingPoint, setPendingPoint] = useState<{ x: number; y: number; region: AnatomicalRegion } | null>(null)
  const [intensity, setIntensity] = useState(5)
  const [painType, setPainType] = useState<PainType>('cramping')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const handleSvgClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current) return
      const rect = svgRef.current.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100

      const region = detectRegion(x, y, view)
      if (!region) return

      setPendingPoint({ x, y, region })
      setIntensity(5)
      setPainType('cramping')
    },
    [view]
  )

  const handleAdd = useCallback(async () => {
    if (!pendingPoint || saving) return
    setSaving(true)
    try {
      const point = await addPainPoint({
        log_id: logId,
        x: pendingPoint.x,
        y: pendingPoint.y,
        body_region: `${view}: ${pendingPoint.region.label}`,
        intensity,
        pain_type: painType,
        duration_minutes: null,
      })
      const updated = [...painPoints, point]
      setPainPoints(updated)
      onCountChange(updated.length)
      setPendingPoint(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 1600)
    } catch {
      // Silently fail
    } finally {
      setSaving(false)
    }
  }, [pendingPoint, saving, logId, view, intensity, painType, painPoints, onCountChange])

  const handleDelete = useCallback(
    async (id: string) => {
      setDeletingId(id)
      try {
        await deletePainPoint(id)
        const updated = painPoints.filter((p) => p.id !== id)
        setPainPoints(updated)
        onCountChange(updated.length)
      } catch {
        // Silently fail
      } finally {
        setDeletingId(null)
      }
    },
    [painPoints, onCountChange]
  )

  // Separate front/back pins by body_region prefix
  const viewPins = painPoints.filter(p => p.body_region?.startsWith(`${view}:`))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-full p-1"
             style={{ background: 'var(--bg-elevated)' }}>
          <button
            type="button"
            onClick={() => { setView('front'); setPendingPoint(null) }}
            className="px-3 py-1 text-xs font-semibold rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-offset-1"
            style={{
              background: view === 'front' ? 'var(--accent-sage)' : 'transparent',
              color: view === 'front' ? '#fff' : 'var(--text-secondary)',
            }}
          >
            Front
          </button>
          <button
            type="button"
            onClick={() => { setView('back'); setPendingPoint(null) }}
            className="px-3 py-1 text-xs font-semibold rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-offset-1"
            style={{
              background: view === 'back' ? 'var(--accent-sage)' : 'transparent',
              color: view === 'back' ? '#fff' : 'var(--text-secondary)',
            }}
          >
            Back
          </button>
        </div>
        <SaveIndicator show={saved} />
      </div>

      <div
        className="relative mx-auto rounded-xl"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-light)',
          maxWidth: 220,
          aspectRatio: '1 / 2',
        }}
      >
        <svg
          ref={svgRef}
          viewBox="0 0 100 104"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
          onClick={handleSvgClick}
          role="img"
          aria-label={`${view} view body map for placing pain pins`}
          style={{ cursor: 'crosshair', display: 'block' }}
        >
          {/* Body silhouette */}
          <path
            d={view === 'front' ? FRONT_BODY_PATH : BACK_BODY_PATH}
            fill="var(--bg-card)"
            stroke="var(--border-medium)"
            strokeWidth="0.8"
            strokeLinejoin="round"
          />

          {/* Subtle center line for back view */}
          {view === 'back' && (
            <line x1="50" y1="22" x2="50" y2="55" stroke="var(--border-light)"
                  strokeWidth="0.4" strokeDasharray="1 1.5" opacity="0.6" />
          )}

          {/* Existing pins for this view */}
          {viewPins.map(pin => (
            <g key={pin.id} style={{ cursor: 'pointer' }}
               onClick={(e) => { e.stopPropagation(); handleDelete(pin.id) }}>
              <circle
                cx={pin.x}
                cy={pin.y}
                r={3.5}
                fill={getPinColor(pin.intensity)}
                stroke="#fff"
                strokeWidth="0.8"
                opacity={deletingId === pin.id ? 0.4 : 1}
              >
                <title>{pin.body_region} - {pin.intensity}/10 {pin.pain_type ?? ''}. Tap to remove.</title>
              </circle>
              <text x={pin.x} y={pin.y + 1.2} fontSize="3" fill="#fff"
                    textAnchor="middle" fontWeight="700">
                {pin.intensity}
              </text>
            </g>
          ))}

          {/* Pending pin preview */}
          {pendingPoint && (
            <g>
              <circle cx={pendingPoint.x} cy={pendingPoint.y} r={4}
                      fill={getPinColor(intensity)} stroke="#fff"
                      strokeWidth="0.8" opacity="0.8">
                <animate attributeName="r" values="3;4.5;3" dur="1.4s" repeatCount="indefinite" />
              </circle>
              <circle cx={pendingPoint.x} cy={pendingPoint.y} r={7}
                      fill="none" stroke={getPinColor(intensity)}
                      strokeWidth="0.5" opacity="0.5">
                <animate attributeName="r" values="5;8;5" dur="1.4s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.5;0;0.5" dur="1.4s" repeatCount="indefinite" />
              </circle>
            </g>
          )}
        </svg>

        {!pendingPoint && viewPins.length === 0 && (
          <p className="absolute inset-x-0 bottom-2 text-center text-[10px] font-medium pointer-events-none"
             style={{ color: 'var(--text-muted)' }}>
            Tap any area to drop a pin
          </p>
        )}
      </div>

      {/* Pending point entry form */}
      {pendingPoint && (
        <div className="rounded-xl border p-4 space-y-3"
             style={{ background: 'var(--bg-elevated)', borderColor: 'var(--accent-sage)' }}>
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {pendingPoint.region.label}
            </h4>
            <button
              type="button"
              onClick={() => setPendingPoint(null)}
              className="flex h-7 w-7 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-offset-1"
              style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}
              aria-label="Cancel pin placement"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5"
                      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                Intensity (0 to 10)
              </label>
              <span className="text-xs font-semibold" style={{ color: getPinColor(intensity) }}>
                {intensity} - {getIntensityLabel(intensity)}
              </span>
            </div>
            <div className="flex justify-between gap-1" role="radiogroup" aria-label="Pain intensity">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((val) => (
                <button
                  key={val}
                  type="button"
                  role="radio"
                  aria-checked={val === intensity}
                  onClick={() => setIntensity(val)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-1"
                  style={{
                    background: val === intensity ? getPinColor(val) : 'var(--bg-card)',
                    color: val === intensity ? '#fff' : 'var(--text-secondary)',
                    minWidth: 28,
                    minHeight: 28,
                  }}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium"
                   style={{ color: 'var(--text-muted)' }}>
              Pain type
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PAIN_TYPES.map((pt) => (
                <button
                  key={pt.value}
                  type="button"
                  onClick={() => setPainType(pt.value)}
                  aria-pressed={painType === pt.value}
                  className="rounded-full px-3 py-1.5 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-1"
                  style={{
                    minHeight: 32,
                    background: painType === pt.value ? 'var(--accent-sage)' : 'var(--bg-card)',
                    color: painType === pt.value ? '#fff' : 'var(--text-secondary)',
                    border: painType === pt.value
                      ? '1px solid var(--accent-sage)'
                      : '1px solid var(--border)',
                  }}
                >
                  {pt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleAdd}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2"
            style={{
              background: 'var(--accent-sage)',
              minHeight: 44,
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving...' : `Save pain pin at ${pendingPoint.region.label}`}
          </button>
        </div>
      )}

      {/* Pin list */}
      {painPoints.length > 0 && !pendingPoint && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider"
             style={{ color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
            {painPoints.length} pin{painPoints.length === 1 ? '' : 's'} - tap on body to remove
          </p>
          {painPoints.slice(0, 5).map((pt) => (
            <div key={pt.id}
                 className="flex w-full items-center gap-2.5 rounded-xl border px-3 py-2"
                 style={{
                   background: 'var(--bg-elevated)',
                   borderColor: 'var(--border-light)',
                   minHeight: 44,
                 }}>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ background: getPinColor(pt.intensity) }}>
                {pt.intensity}
              </span>
              <div className="flex flex-col items-start text-left min-w-0">
                <span className="text-sm font-medium truncate"
                      style={{ color: 'var(--text-primary)' }}>
                  {pt.body_region}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {pt.pain_type ? pt.pain_type.charAt(0).toUpperCase() + pt.pain_type.slice(1) : 'Unspecified'} - {getIntensityLabel(pt.intensity)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
