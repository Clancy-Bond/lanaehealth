/**
 * Shared shapes for the v2 meds card + dose log.
 *
 * The source of truth for which meds Lanae takes is
 * `health_profile.medications.content` JSONB. This module reads that
 * shape, normalizes it, and gives the rest of the app a stable type
 * to bind to.
 */

export type MedSlot = 'morning' | 'midday' | 'night'

export interface ScheduledMed {
  /** Stable slug, used as med_doses.med_slug. */
  slug: string
  name: string
  /** Which slots this med fills in a normal day. */
  slots: MedSlot[]
  /** Free-form indication ("antihistamine", "asthma maintenance"). */
  indication?: string
  /** Optional standard dose label ("100 mg", "1 tablet"). */
  dose_text?: string
}

export interface PrnMed {
  slug: string
  name: string
  indication: string
  /** Used as the dose_text on a PRN tap if the user does not edit it. */
  default_dose_text?: string
}

export interface MedsConfig {
  scheduled: ScheduledMed[]
  as_needed: PrnMed[]
}

export interface MedDose {
  id: string
  med_slug: string
  med_name: string
  kind: 'scheduled' | 'prn'
  slot: MedSlot | null
  source: 'tap' | 'note_extraction' | 'manual_edit'
  dose_text: string | null
  taken_at: string
  notes: string | null
}

/** Empty config used when health_profile is missing or malformed. */
export const EMPTY_MEDS_CONFIG: MedsConfig = {
  scheduled: [],
  as_needed: [],
}
