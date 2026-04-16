/**
 * Intelligence Dashboard
 *
 * Aggregates all 5 intelligence engines + clinical reports in one view.
 * This is the "AI knows what's happening" page -- what no competitor has.
 *
 * Shows:
 * - Cycle intelligence (phase, ovulation, period prediction, flags)
 * - Adaptive calorie target (TDEE, macros, weekly adjustment)
 * - Exercise intelligence (safe ceilings, weekly capacity, POTS progression)
 * - Vitals intelligence (orthostatic trend, outlier detection)
 * - PRN medication intelligence summary
 * - Link to doctor-ready condition reports
 */

import { IntelligenceDashboard } from '@/components/intelligence/IntelligenceDashboard'

export const dynamic = 'force-dynamic'

export default function IntelligencePage() {
  return <IntelligenceDashboard />
}
