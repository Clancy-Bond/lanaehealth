/**
 * MedsCard (server)
 *
 * Reads Lanae's med list (health_profile.medications) and today's
 * doses (med_doses), composes the today-state, and hands it to the
 * client component for rendering + tap interactions.
 *
 * Renders nothing when the med list is empty (e.g. a brand-new user
 * who has not configured meds yet) so this card never shows as a
 * confusing empty placeholder.
 */
import { loadMedsConfig } from '@/lib/meds/load-meds-config'
import { listMedDoses } from '@/lib/meds/dose-log'
import { buildMedsTodayState } from '@/lib/meds/today-state'
import MedsCardClient from './MedsCardClient'

interface MedsCardProps {
  userId: string | null
  /** ISO date YYYY-MM-DD for "today" in the user's frame. */
  todayLocal: string
}

export default async function MedsCard({ userId, todayLocal }: MedsCardProps) {
  const config = await loadMedsConfig(userId)
  if (config.scheduled.length === 0 && config.as_needed.length === 0) {
    return null
  }

  // Pull a 30-day window so the PRN sub-section can show "last taken: 11
  // days ago" without a separate query. 30 days is plenty for "infrequent
  // PRN" semantics; older history is reachable via the meds settings page.
  const today = new Date(todayLocal + 'T00:00:00Z')
  const fromIso = new Date(today.getTime() - 30 * 86_400_000).toISOString()
  const toIso = new Date(today.getTime() + 86_400_000 - 1).toISOString()
  const doses = await listMedDoses({ userId, fromIso, toIso, limit: 500 })
  const state = buildMedsTodayState({ config, doses, todayLocal })

  return <MedsCardClient state={state} todayLocal={todayLocal} />
}
