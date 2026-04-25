/*
 * AppearanceCard
 *
 * Sits at the top of /v2/settings. Owns the Dark / Light / System
 * theme toggle. Lanae cannot read the default Oura-dark chrome, so
 * this is the first card in the list, above Oura sync, on purpose.
 *
 * The voice mirrors the rest of the settings page: short, kind,
 * explanatory. The subtext under the header tells the user that
 * "Auto" follows their phone's light/dark setting so they do not
 * have to think about it twice a day.
 *
 * Pure server component shell wrapping the client-side toggle.
 */
import { Card } from '@/v2/components/primitives'
import { ThemeToggle } from '@/v2/components/shell'

export default function AppearanceCard() {
  return (
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-1)' }}>
          <h2
            style={{
              fontSize: 'var(--v2-text-lg)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)',
              margin: 0,
            }}
          >
            Appearance
          </h2>
          <p
            style={{
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              margin: 0,
              lineHeight: 'var(--v2-leading-normal)',
            }}
          >
            Choose how the app looks. System matches your phone&apos;s setting.
          </p>
        </div>
        <ThemeToggle />
      </div>
    </Card>
  )
}
