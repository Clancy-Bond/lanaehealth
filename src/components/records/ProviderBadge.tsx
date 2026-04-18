'use client'

/**
 * ProviderBadge - color-coded specialty pill used in the unified records
 * timeline (Wave 2c D1+F6). Colors map to the --event-* design tokens so
 * every kind of row (labs/imaging/appointments/events/problems) gets a
 * consistent hue per specialty.
 */

interface SpecialtyStyle {
  /** Background + border color for the chip (uses an alpha mix at runtime). */
  color: string
  /** Label to render inside the chip. */
  label: string
}

/**
 * Map a specialty name onto one of the --event-* tokens. We keep this
 * centralized so the filter bar, the timeline row, and any future use
 * (doctor prep sheet, records export) stay in lockstep.
 */
export function styleForSpecialty(specialty: string | null): SpecialtyStyle {
  const s = (specialty ?? '').toLowerCase().trim()

  // PCP / internal medicine / family medicine -> neutral slate
  if (
    s === 'pcp' ||
    s === 'internal medicine' ||
    s === 'im' ||
    s === 'family medicine'
  ) {
    return { color: 'var(--event-appointment)', label: 'PCP' }
  }

  // OB/GYN and reproductive health -> blush (warm, female-coded)
  if (s === 'ob/gyn' || s === 'obgyn' || s === 'gynecology') {
    return { color: 'var(--accent-blush)', label: 'OB/GYN' }
  }

  // Cardiology -> diagnosis blue (steady, clinical)
  if (s === 'cardiology' || s === 'cardiologist') {
    return { color: 'var(--event-diagnosis)', label: 'Cardiology' }
  }

  // Neurology -> medication purple (deeper, brain-coded)
  if (s === 'neurology' || s === 'neurologist') {
    return { color: 'var(--event-medication)', label: 'Neurology' }
  }

  // Imaging -> imaging teal
  if (s === 'imaging' || s === 'radiology') {
    return { color: 'var(--event-imaging)', label: 'Imaging' }
  }

  // Labs fall back to the "test" sage token
  if (s === 'labs' || s === 'laboratory') {
    return { color: 'var(--event-test)', label: 'Labs' }
  }

  // Rheumatology / immunology -> symptom orange
  if (s === 'rheumatology' || s === 'immunology') {
    return { color: 'var(--event-symptom)', label: specialty ?? 'Rheumatology' }
  }

  // GI / endo specialists / ENT / allergist / other: fall through to a
  // neutral muted tone so we don't invent a specific color.
  return {
    color: 'var(--text-muted)',
    label: specialty ?? 'Other',
  }
}

interface ProviderBadgeProps {
  specialty: string | null
  /** Size variant. Default is `sm` which matches the inline chip style. */
  size?: 'sm' | 'xs'
}

export function ProviderBadge({ specialty, size = 'sm' }: ProviderBadgeProps) {
  const { color, label } = styleForSpecialty(specialty)
  const fontSize = size === 'xs' ? '10px' : '11px'
  const padding = size === 'xs' ? '1px 6px' : '2px 8px'

  return (
    <span
      className="inline-flex items-center rounded-full font-semibold whitespace-nowrap"
      style={{
        // 12% alpha mix of the token keeps each badge readable without
        // competing with the primary card content.
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
        color,
        fontSize,
        padding,
        letterSpacing: '0.01em',
      }}
    >
      {label}
    </span>
  )
}
