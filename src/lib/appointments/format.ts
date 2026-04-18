/**
 * Display formatting for appointment fields.
 *
 * The myAH import wrote raw Adventist Health scheduling codes (e.g.
 * "PrmCreKailAul-CS", "OBGYNUluk-CS") into appointments.clinic. Those
 * are internal resource identifiers, not clinic names, and must never
 * leak into the UI. formatClinicName maps known codes to their human
 * labels and hides unknown codes that still match the scheduling
 * pattern so we fail closed instead of shouting "PrmCreKailAul-CS" at
 * a doctor.
 */

const CLINIC_CODE_MAP: Record<string, string> = {
  'PrmCreKailAul-CS': 'AH Kailua - Aulike (Primary Care)',
  'PrmCreKaiLAul-CS': 'AH Kailua - Aulike (Primary Care)',
  'OBGYNUluk-CS': 'AH Kailua - Ulukahiki (OB/GYN)',
  'Spcity103Uluk-CS': 'AH Kailua - Ulukahiki (Specialty)',
};

export function formatClinicName(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (CLINIC_CODE_MAP[trimmed]) return CLINIC_CODE_MAP[trimmed];
  // Scheduling-code heuristic: CamelCase prefix with optional digits,
  // followed by "-CS" or similar 2-letter suffix. Fail closed.
  if (/^[A-Z][A-Za-z0-9]*-[A-Z]{2}$/.test(trimmed)) return null;
  return trimmed;
}
