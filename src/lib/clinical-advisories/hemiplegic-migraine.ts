/**
 * Hemiplegic migraine advisory content.
 *
 * Surfaced when a user selects motor aura in the active headache log. Per
 * IHS ICHD-3 (3rd edition, 2018) criteria 1.2.3, hemiplegic migraine is
 * defined by aura that includes motor weakness. It is rare but important
 * to flag because:
 *
 *   1. One-sided weakness during a headache can mimic stroke, and the
 *      first presentation warrants clinical evaluation to rule out
 *      vascular causes.
 *   2. Standard triptan acute-abortive therapy is typically avoided in
 *      hemiplegic presentations (vasoconstrictor risk), so the treatment
 *      pathway differs from common migraine.
 *
 * This module returns non-diagnostic, advisory language that respects the
 * non-shaming voice rule (docs/plans/2026-04-16-non-shaming-voice-rule.md)
 * and the "Memory is HINTS not GROUND TRUTH" principle from CLAUDE.md.
 *
 * Design intent: Lanae can always save the log. The advisory is
 * informational only. No blocking modal, no diagnostic claim.
 *
 * Spec: docs/plans/2026-04-17-wave-2b-briefs.md brief A2.
 * Reference: docs/competitive/headache-diary/implementation-notes.md
 *            Feature 2 (Aura tracking multi-category).
 * Clinical reference: International Classification of Headache Disorders,
 *                     3rd edition (ICHD-3), criterion 1.2.3.
 */

/**
 * Short one-line headline used for in-card advisory banners. Written in
 * plain language per the voice rule: no diagnostic claim, no alarm
 * language, no "you may have" framing.
 */
export const HEMIPLEGIC_HEADLINE = 'Motor weakness during a headache is worth a conversation'

/**
 * Primary advisory body. The exact copy required by the Wave 2b brief and
 * the non-shaming voice rule. Must remain "If first time or lasts 24h,
 * contact your doctor" phrasing rather than any diagnostic "you may have"
 * construction.
 */
export const HEMIPLEGIC_ADVISORY =
  'Motor weakness during a headache can indicate hemiplegic migraine. If this is the first time or symptoms last over 24 hours, contact your doctor.'

/**
 * Context paragraph expanding on why this matters without claiming a
 * diagnosis. Covers the triptan interaction without prescribing behavior:
 * the user's neurologist decides acute therapy.
 */
export const HEMIPLEGIC_CONTEXT =
  'Hemiplegic migraine is rare, and one-sided weakness can also look like other conditions a clinician should evaluate. Triptan-class medications are typically avoided for this pattern, so your acute plan may differ from common migraine.'

/**
 * Call-to-action link text pointing to the appointment scheduler. We route
 * to /doctor/appointments rather than /doctor so follow-up intent is
 * captured immediately, not scattered across the doctor hub.
 */
export const HEMIPLEGIC_CTA_TEXT = 'Schedule a follow-up visit'
export const HEMIPLEGIC_CTA_HREF = '/doctor/appointments'

/**
 * Risk factors listed for user education. Each is non-diagnostic and
 * sourced from IHS 2018 guidance plus common practice. These populate the
 * expandable "What raises the likelihood?" disclosure.
 */
export const HEMIPLEGIC_RISK_FACTORS: ReadonlyArray<string> = [
  'Family history of migraine with motor aura on one or both sides',
  'Weakness that clearly affects one side of the body, not both',
  'Symptoms that fully resolve between attacks',
  'Aura symptoms that last longer than an hour',
  'Aura that occurs with or without headache pain',
] as const

/**
 * Red-flag criteria that convert the advisory from "worth a conversation"
 * into "seek urgent evaluation". Kept separate so the UI can escalate the
 * card tone without mixing diagnostic and urgent-care language.
 *
 * Wording: neutral fact + CTA, per the dangerous-threshold exception in
 * the non-shaming voice rule.
 */
export const HEMIPLEGIC_RED_FLAGS: ReadonlyArray<string> = [
  'Sudden, severe onset unlike prior headaches',
  'Weakness that does not resolve within 72 hours',
  'Loss of consciousness, seizure, or new confusion',
  'First-ever episode with motor symptoms',
] as const

/**
 * Structured advisory payload consumed by the AuraCategoryPicker and any
 * future non-UI surface (Claude-API explanation, doctor-prep sheet). The
 * separation of fields lets rendering adapt without string-parsing.
 */
export interface HemiplegicAdvisory {
  headline: string
  body: string
  context: string
  cta: { text: string; href: string }
  riskFactors: ReadonlyArray<string>
  redFlags: ReadonlyArray<string>
  /** True when the red-flag copy should be elevated visually. */
  urgent: boolean
}

/**
 * Build the advisory object. An `options` argument is supported so callers
 * can elevate to the urgent variant based on user input (first-time
 * episode, 24h duration flag) without hardcoding that logic here.
 */
export function getHemiplegicAdvisory(
  options: { firstTime?: boolean; durationHours?: number } = {},
): HemiplegicAdvisory {
  const urgent =
    Boolean(options.firstTime) ||
    (typeof options.durationHours === 'number' && options.durationHours >= 24)

  return {
    headline: HEMIPLEGIC_HEADLINE,
    body: HEMIPLEGIC_ADVISORY,
    context: HEMIPLEGIC_CONTEXT,
    cta: { text: HEMIPLEGIC_CTA_TEXT, href: HEMIPLEGIC_CTA_HREF },
    riskFactors: HEMIPLEGIC_RISK_FACTORS,
    redFlags: HEMIPLEGIC_RED_FLAGS,
    urgent,
  }
}

/**
 * Guard that checks the advisory body for diagnostic language that the
 * voice rule forbids. Exported so tests can lock down the copy against
 * accidental drift (a later refactor adding "you have" framing should
 * fail loudly).
 */
export function isNonDiagnostic(text: string): boolean {
  const banned = [
    /\byou (have|may have|probably have|likely have)\b/i,
    /\bdiagnos(ed|is|e)\b/i,
    /\byou are\s+(hemiplegic|migrainous)\b/i,
    /\byou suffer from\b/i,
  ]
  return !banned.some(pattern => pattern.test(text))
}
