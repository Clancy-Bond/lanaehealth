/*
 * formField
 *
 * Shared input styling for Session 05 weekly-tail forms. The v2 primitives
 * library currently ships Button, Banner, Toggle, SegmentedControl and
 * Stepper but no styled <input>/<textarea>/<select>. Session 05 ships four
 * forms (orthostatic/new, MyAH entry, BP/HR quick-log, hormone entry) that
 * all need the same dark-chrome form controls: cream labels go where the
 * palette is explanatory, dark labels go on the primary chrome, and the
 * control itself sits on --v2-bg-card with a subtle --v2-border.
 *
 * Exported as plain React.CSSProperties objects rather than a Field
 * component so callers can still customize a single field's flex / width
 * without writing a subclass. Session 05 routes only : promote to
 * src/v2/components/* via FOUNDATION-REQUEST if a second session needs it.
 *
 * See ./README.md for the promotion policy.
 */
import type { CSSProperties } from 'react'

/*
 * Eyebrow-style label: uppercase, tracked, muted. Matches the existing
 * Field component in PeriodLogFormV2.
 */
export const fieldLabelStyle: CSSProperties = {
  fontSize: 'var(--v2-text-xs)',
  color: 'var(--v2-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: 'var(--v2-tracking-wide)',
  fontWeight: 'var(--v2-weight-semibold)',
}

/*
 * Dark chrome input: card background, 1px subtle border, 12px radius,
 * generous touch-target padding (44pt effective height). Used for
 * <input type="text|number|date|time"> and similar.
 */
export const fieldInputStyle: CSSProperties = {
  width: '100%',
  padding: '0.75rem 1rem',
  borderRadius: 'var(--v2-radius-md)',
  background: 'var(--v2-bg-card)',
  color: 'var(--v2-text-primary)',
  border: '1px solid var(--v2-border)',
  fontSize: 'var(--v2-text-base)',
  fontFamily: 'inherit',
  lineHeight: 'var(--v2-leading-normal)',
  minHeight: 'var(--v2-touch-target-min)',
  outline: 'none',
}

/*
 * Textarea inherits input visuals + vertical resize + min-height that
 * comfortably fits two lines without scroll.
 */
export const fieldTextareaStyle: CSSProperties = {
  ...fieldInputStyle,
  minHeight: 80,
  resize: 'vertical',
}

/*
 * Select uses the input styling on a native OS control. The MobileShell
 * root already sets `color-scheme: dark` via the .v2 class, so Safari /
 * Chrome / Firefox render the native chevron in a dark-compatible tone
 * without any custom bitmap. That keeps the file token-pure and avoids
 * a hex literal in a data URI. Extra right padding leaves room for the
 * chevron.
 */
export const fieldSelectStyle: CSSProperties = {
  ...fieldInputStyle,
  paddingRight: '2.5rem',
}
