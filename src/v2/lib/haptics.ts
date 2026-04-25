/*
 * Haptics
 *
 * Tiny wrapper around navigator.vibrate. The Vibration API is widely
 * supported on Android and Chrome-derived mobile browsers but is a
 * no-op on iOS Safari and on desktop. We never branch on user-agent;
 * we just feature-test and fall back silently when the call is not
 * available.
 *
 * Reduced motion: prefers-reduced-motion implies prefers-reduced
 * sensory overload too. When the user has it set, we skip vibration
 * entirely. This keeps haptics consistent with our motion rules and
 * avoids surprising users with a buzz they did not opt in to.
 *
 * All entry points are intentionally synchronous and return void so
 * callers can fire-and-forget from button onClick handlers without
 * await ceremony.
 */

function reducedMotion(): boolean {
  if (typeof window === 'undefined') return true
  if (typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function canVibrate(): boolean {
  if (typeof navigator === 'undefined') return false
  if (typeof navigator.vibrate !== 'function') return false
  return true
}

function buzz(pattern: number | number[]): void {
  if (!canVibrate() || reducedMotion()) return
  try {
    navigator.vibrate(pattern)
  } catch {
    // Some browsers throw on certain patterns; never let haptics
    // bubble into user-facing failures.
  }
}

/** ~10ms tap. Use for tab switches, segmented control changes, light
 *  acknowledgement of a tap. */
export function lightTap(): void {
  buzz(10)
}

/** ~20ms tap. Use for FAB primary action, opening a sheet, committing
 *  a small change. */
export function mediumTap(): void {
  buzz(20)
}

/** ~35ms tap. Use for destructive actions or strong commit moments
 *  (e.g. confirming a delete). */
export function heavyTap(): void {
  buzz(35)
}

/** Short two-pulse pattern: a confirm. Use after a successful save or
 *  log entry. */
export function success(): void {
  buzz([12, 60, 18])
}

/** Triple short pulse pattern: a warning. Use on save failure, network
 *  error, or validation block. */
export function warning(): void {
  buzz([30, 40, 30, 40, 30])
}
