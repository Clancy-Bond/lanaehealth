/*
 * /v2/settings (server component)
 *
 * Essentials in v2, links out for the rest. The five sections are
 * deliberately scoped to the things a phone user actually reaches
 * for: Oura sync status, the home-screen favorites, privacy
 * toggles, and About. Integrations, imports, exports, the AI
 * knowledge base, and the module customizer stay on the legacy
 * /settings surface because they belong to a desktop workflow.
 *
 * Fetch happens once, server-side, via the same helpers the
 * legacy page uses so the two surfaces never disagree about Oura
 * connection state, pinned metrics, or privacy choices. We throw
 * on any helper failure so a broken query is distinguishable from
 * "no data yet" - same pattern as /v2/records and /v2/labs.
 *
 * patient-id: the legacy /settings page does not pass a
 * patient-id explicitly; every helper defaults to 'lanae' because
 * this is a single-patient app. We mirror that exactly.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { checkOuraConnection, getLastSyncTime } from '@/lib/api/oura'
import { getFavorites } from '@/lib/api/favorites'
import { getPrivacyPrefs } from '@/lib/api/privacy-prefs'
import { getCurrentUser } from '@/lib/auth/get-user'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import AccountCard from './_components/AccountCard'
import AppearanceCard from './_components/AppearanceCard'
import OuraStatusCard from './_components/OuraStatusCard'
import FavoritesSection from './_components/FavoritesSection'
import PrivacyTogglesCard from './_components/PrivacyTogglesCard'
import LegacyLinksCard from './_components/LegacyLinksCard'
import AboutCard from './_components/AboutCard'

export const dynamic = 'force-dynamic'

// Read the shipped version once at module scope. If package.json
// cannot be read (e.g. an edge runtime), fall back to the string
// so the About card still renders something useful.
function readAppVersion(): string {
  try {
    const raw = readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')
    const pkg = JSON.parse(raw) as { version?: string }
    return typeof pkg.version === 'string' && pkg.version.length > 0
      ? pkg.version
      : 'unknown'
  } catch {
    return 'unknown'
  }
}

export default async function V2SettingsPage() {
  const [connected, lastSyncTime, favorites, prefs, user] = await Promise.all([
    checkOuraConnection(),
    getLastSyncTime(),
    getFavorites(),
    getPrivacyPrefs(),
    getCurrentUser(),
  ])

  const version = readAppVersion()

  return (
    <MobileShell top={<TopAppBar variant="large" title="Settings" />}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-4)',
          padding: 'var(--v2-space-4)',
          paddingBottom: 'var(--v2-space-8)',
        }}
      >
        <AccountCard email={user?.email ?? null} />
        <AppearanceCard />
        <OuraStatusCard connected={connected} lastSyncTime={lastSyncTime} />
        <FavoritesSection initialItems={favorites} />
        <PrivacyTogglesCard prefs={prefs} />
        <LegacyLinksCard />
        <AboutCard version={version} />
      </div>
    </MobileShell>
  )
}
