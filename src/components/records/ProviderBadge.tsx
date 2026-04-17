'use client'

// ProviderBadge - small color-coded chip that identifies a provider specialty
// on unified timeline rows. Uses warm modern tokens only (no raw hex outside
// this file's local palette, which mirrors tokens defined elsewhere).
//
// Specialty color map per docs/competitive/guava-health/implementation-notes.md
// Feature 1. Unknown specialties fall back to neutral muted gray.

import type { CSSProperties } from 'react'

export type ProviderSpecialty = string | null | undefined

interface SpecialtyStyle {
  label: string
  bg: string
  color: string
}

// Normalize various inputs (free-text specialties, casing differences) into a
// canonical key we can look up. Unknown/null inputs return null so the caller
// can render the neutral fallback.
function canonicalSpecialty(raw: ProviderSpecialty): string | null {
  if (!raw) return null
  const key = raw.trim().toLowerCase()
  if (!key) return null

  // OB/GYN family
  if (
    key.includes('ob/gyn') ||
    key.includes('obgyn') ||
    key.includes('ob gyn') ||
    key.includes('gynec') ||
    key.includes('obstetric') ||
    key.includes('endometriosis')
  ) {
    return 'obgyn'
  }
  // Cardiology
  if (key.includes('cardio')) return 'cardio'
  // Neurology (includes headache, migraine, neurologist)
  if (key.includes('neuro') || key.includes('headache') || key.includes('migraine')) {
    return 'neuro'
  }
  // Primary care / internal medicine
  if (
    key === 'pcp' ||
    key.includes('primary') ||
    key.includes('internal medicine') ||
    key === 'im' ||
    key.includes('family medicine')
  ) {
    return 'pcp'
  }
  // GI / gastro
  if (key.includes('gastro') || key === 'gi') return 'gi'
  // Allergy / ENT / Rheum grouped as "specialist" fallback tier for now
  if (key.includes('rheumat')) return 'rheum'
  if (key.includes('allerg')) return 'allergy'
  if (key.includes('ent') || key.includes('ear nose')) return 'ent'
  // Imaging / radiology - shows up when an imaging study has a reading radiologist
  if (key.includes('radiolog') || key.includes('imaging')) return 'imaging'
  return null
}

// Token-aligned style map. Colors reuse existing CSS vars where possible and
// only introduce new hues for specialties not covered by the base palette.
function styleForSpecialty(canonical: string | null, raw: ProviderSpecialty): SpecialtyStyle {
  switch (canonical) {
    case 'pcp':
      // Sage - primary care, the "home base" provider
      return {
        label: raw ?? 'PCP',
        bg: 'var(--accent-sage-muted)',
        color: 'var(--accent-sage)',
      }
    case 'obgyn':
      // Blush - reproductive health
      return {
        label: raw ?? 'OB/GYN',
        bg: 'var(--accent-blush-muted)',
        color: 'var(--accent-blush)',
      }
    case 'cardio':
      // Deep plum via event-medication token (purple family, but muted)
      return {
        label: raw ?? 'Cardiology',
        bg: 'rgba(139, 92, 246, 0.12)',
        color: '#8B5CF6',
      }
    case 'neuro':
      // Warm amber
      return {
        label: raw ?? 'Neurology',
        bg: 'rgba(217, 169, 78, 0.14)',
        color: '#9A7A2C',
      }
    case 'imaging':
      // Cool teal, matches event-imaging
      return {
        label: raw ?? 'Imaging',
        bg: 'rgba(6, 182, 212, 0.12)',
        color: '#06B6D4',
      }
    case 'gi':
      return {
        label: raw ?? 'GI',
        bg: 'rgba(217, 169, 78, 0.14)',
        color: '#9A7A2C',
      }
    case 'rheum':
    case 'allergy':
    case 'ent':
      return {
        label: raw ?? 'Specialist',
        bg: 'var(--bg-elevated)',
        color: 'var(--text-secondary)',
      }
    default:
      return {
        label: raw ?? 'Provider',
        bg: 'var(--bg-elevated)',
        color: 'var(--text-secondary)',
      }
  }
}

interface ProviderBadgeProps {
  specialty: ProviderSpecialty
  size?: 'sm' | 'md'
  style?: CSSProperties
}

export function ProviderBadge({ specialty, size = 'sm', style }: ProviderBadgeProps) {
  const canonical = canonicalSpecialty(specialty)
  const s = styleForSpecialty(canonical, specialty)
  const pad = size === 'md' ? '0.25rem 0.625rem' : '0.125rem 0.5rem'
  const fontSize = size === 'md' ? '0.75rem' : '0.6875rem'
  return (
    <span
      className="inline-flex items-center rounded-full font-medium whitespace-nowrap"
      style={{
        background: s.bg,
        color: s.color,
        padding: pad,
        fontSize,
        lineHeight: 1.2,
        ...style,
      }}
    >
      {s.label}
    </span>
  )
}

// Exported for tests and reuse by TimelineEntry when deriving a provider dot.
export function getProviderColor(specialty: ProviderSpecialty): string {
  const canonical = canonicalSpecialty(specialty)
  return styleForSpecialty(canonical, specialty).color
}

export { canonicalSpecialty }
