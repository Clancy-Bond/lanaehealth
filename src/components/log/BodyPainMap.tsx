'use client'

import { useState, useCallback } from 'react'
import type { PainPoint, PainType } from '@/lib/types'
import { addPainPoint, deletePainPoint } from '@/lib/api/logs'
import SaveIndicator from './SaveIndicator'

interface BodyPainMapProps {
  logId: string
  initialPainPoints: PainPoint[]
  onCountChange: (count: number) => void
}

// Body regions relevant to endometriosis, each with an SVG-friendly label and position
interface BodyRegion {
  id: string
  label: string
  // Grid position in 3-column layout
  gridArea: string
}

const BODY_REGIONS: BodyRegion[] = [
  { id: 'head', label: 'Head', gridArea: '1 / 2 / 2 / 3' },
  { id: 'chest', label: 'Chest', gridArea: '2 / 2 / 3 / 3' },
  { id: 'upper-abdomen', label: 'Upper Abdomen', gridArea: '3 / 2 / 4 / 3' },
  { id: 'lower-abdomen', label: 'Lower Abdomen / Pelvis', gridArea: '4 / 2 / 5 / 3' },
  { id: 'lower-back', label: 'Lower Back', gridArea: '5 / 2 / 6 / 3' },
  { id: 'left-hip', label: 'Left Hip', gridArea: '4 / 1 / 5 / 2' },
  { id: 'right-hip', label: 'Right Hip', gridArea: '4 / 3 / 5 / 4' },
  { id: 'legs', label: 'Legs', gridArea: '6 / 2 / 7 / 3' },
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
  if (intensity <= 2) return 'var(--pain-low)'
  if (intensity <= 4) return 'var(--pain-mild)'
  if (intensity <= 6) return 'var(--pain-moderate)'
  if (intensity <= 8) return 'var(--pain-severe)'
  return 'var(--pain-extreme)'
}

function getIntensityLabel(val: number): string {
  if (val <= 2) return 'Mild'
  if (val <= 4) return 'Noticeable'
  if (val <= 6) return 'Moderate'
  if (val <= 8) return 'Severe'
  return 'Extreme'
}

export default function BodyPainMap({
  logId,
  initialPainPoints,
  onCountChange,
}: BodyPainMapProps) {
  const [painPoints, setPainPoints] = useState<PainPoint[]>(initialPainPoints)
  const [selectedRegion, setSelectedRegion] = useState<BodyRegion | null>(null)
  const [intensity, setIntensity] = useState(5)
  const [painType, setPainType] = useState<PainType>('cramping')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Get points for a specific region
  const getRegionPoints = useCallback(
    (regionId: string) => painPoints.filter((p) => p.body_region === regionId),
    [painPoints]
  )

  // Handle region tap
  const handleRegionTap = useCallback((region: BodyRegion) => {
    setSelectedRegion(region)
    setIntensity(5)
    setPainType('cramping')
  }, [])

  // Handle add pain point
  const handleAdd = useCallback(async () => {
    if (!selectedRegion || saving) return
    setSaving(true)
    try {
      const point = await addPainPoint({
        log_id: logId,
        x: 0, // Not used in grid-based approach
        y: 0,
        body_region: selectedRegion.label,
        intensity,
        pain_type: painType,
        duration_minutes: null,
      })
      const updated = [...painPoints, point]
      setPainPoints(updated)
      onCountChange(updated.length)
      setSelectedRegion(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 1600)
    } catch {
      // Silently fail
    } finally {
      setSaving(false)
    }
  }, [selectedRegion, saving, logId, intensity, painType, painPoints, onCountChange])

  // Handle delete pain point
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

  return (
    <div className="space-y-3">
      {/* Save indicator */}
      <div className="flex justify-end">
        <SaveIndicator show={saved} />
      </div>

      {/* Body region grid */}
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: '1fr 1.5fr 1fr',
          gridTemplateRows: 'repeat(6, auto)',
        }}
      >
        {BODY_REGIONS.map((region) => {
          const regionPoints = getRegionPoints(region.label)
          const hasPoints = regionPoints.length > 0
          const isSelected = selectedRegion?.id === region.id
          // For regions with points, show highest intensity color
          const maxIntensity = hasPoints
            ? Math.max(...regionPoints.map((p) => p.intensity))
            : 0

          return (
            <button
              key={region.id}
              type="button"
              onClick={() => handleRegionTap(region)}
              className="relative flex flex-col items-center justify-center rounded-xl px-2 py-2.5 text-center transition-all"
              style={{
                gridArea: region.gridArea,
                minHeight: 44,
                background: isSelected
                  ? 'var(--accent-sage-muted)'
                  : hasPoints
                    ? `color-mix(in srgb, ${getPinColor(maxIntensity)} 12%, var(--bg-elevated))`
                    : 'var(--bg-elevated)',
                border: isSelected
                  ? '2px solid var(--accent-sage)'
                  : hasPoints
                    ? `2px solid ${getPinColor(maxIntensity)}`
                    : '1px solid var(--border-light)',
              }}
            >
              <span
                className="text-xs font-medium"
                style={{
                  color: hasPoints
                    ? getPinColor(maxIntensity)
                    : 'var(--text-primary)',
                }}
              >
                {region.label}
              </span>
              {hasPoints && (
                <div className="mt-1 flex gap-1">
                  {regionPoints.map((pt) => (
                    <span
                      key={pt.id}
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
                      style={{ background: getPinColor(pt.intensity) }}
                    >
                      {pt.intensity}
                    </span>
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Add Pain Point Modal */}
      {selectedRegion && (
        <div
          className="rounded-xl border p-4 space-y-3"
          style={{
            background: 'var(--bg-elevated)',
            borderColor: 'var(--accent-sage)',
          }}
        >
          <div className="flex items-center justify-between">
            <h4
              className="text-sm font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              {selectedRegion.label}
            </h4>
            <button
              type="button"
              onClick={() => setSelectedRegion(null)}
              className="flex h-7 w-7 items-center justify-center rounded-full"
              style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {/* Intensity */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                className="text-xs font-medium"
                style={{ color: 'var(--text-muted)' }}
              >
                Intensity
              </label>
              <span
                className="text-xs font-semibold"
                style={{ color: getPinColor(intensity) }}
              >
                {intensity} - {getIntensityLabel(intensity)}
              </span>
            </div>
            <div className="flex justify-between gap-1">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setIntensity(val)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-all"
                  style={{
                    background:
                      val === intensity ? getPinColor(val) : 'var(--bg-card)',
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

          {/* Pain type */}
          <div>
            <label
              className="mb-1.5 block text-xs font-medium"
              style={{ color: 'var(--text-muted)' }}
            >
              Pain type
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PAIN_TYPES.map((pt) => (
                <button
                  key={pt.value}
                  type="button"
                  onClick={() => setPainType(pt.value)}
                  className="rounded-full px-3 py-1.5 text-xs font-medium transition-all"
                  style={{
                    minHeight: 32,
                    background:
                      painType === pt.value
                        ? 'var(--accent-sage)'
                        : 'var(--bg-card)',
                    color:
                      painType === pt.value ? '#fff' : 'var(--text-secondary)',
                    border:
                      painType === pt.value
                        ? '1px solid var(--accent-sage)'
                        : '1px solid var(--border)',
                  }}
                >
                  {pt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Add button */}
          <button
            type="button"
            onClick={handleAdd}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity"
            style={{
              background: 'var(--accent-sage)',
              minHeight: 44,
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Add Pain Point'}
          </button>
        </div>
      )}

      {/* Existing pain points list */}
      {painPoints.length > 0 && !selectedRegion && (
        <div className="space-y-1.5">
          <p
            className="text-xs font-medium"
            style={{ color: 'var(--text-muted)' }}
          >
            Tap a pin to remove
          </p>
          {painPoints.map((pt) => (
            <button
              key={pt.id}
              type="button"
              onClick={() => handleDelete(pt.id)}
              disabled={deletingId === pt.id}
              className="flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 transition-opacity"
              style={{
                background: 'var(--bg-elevated)',
                borderColor: 'var(--border-light)',
                opacity: deletingId === pt.id ? 0.5 : 1,
                minHeight: 44,
              }}
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ background: getPinColor(pt.intensity) }}
              >
                {pt.intensity}
              </span>
              <div className="flex flex-col items-start text-left">
                <span
                  className="text-sm font-medium"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {pt.body_region}
                </span>
                <span
                  className="text-xs"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {pt.pain_type ? pt.pain_type.charAt(0).toUpperCase() + pt.pain_type.slice(1) : 'Unspecified'}
                </span>
              </div>
              <svg
                className="ml-auto shrink-0"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                style={{ color: 'var(--text-muted)' }}
              >
                <path
                  d="M4 4L12 12M12 4L4 12"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
