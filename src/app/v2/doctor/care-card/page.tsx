import Link from 'next/link'
import { loadCareCardData } from '@/lib/care-card/load'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import CareCardView from '../_components/CareCardView'

export const dynamic = 'force-dynamic'

/*
 * /v2/doctor/care-card
 *
 * One-page emergency summary: identity, diagnoses, meds, allergies,
 * standing orders. Rendered on the explanatory (cream / white)
 * surface because this page is meant to be printed or shared.
 */
export default async function V2CareCardPage() {
  const data = await loadCareCardData()

  return (
    <MobileShell
      top={
        <TopAppBar
          title="Care Card"
          trailing={
            <Link
              href="/v2/doctor"
              style={{
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-text-secondary)',
                textDecoration: 'none',
                padding: 'var(--v2-space-2)',
              }}
            >
              Back
            </Link>
          }
        />
      }
      bottom={null}
    >
      <div className="v2-surface-explanatory" style={{ minHeight: '100%' }}>
        <div
          style={{
            maxWidth: 720,
            margin: '0 auto',
            padding: 'var(--v2-space-5) var(--v2-space-4) var(--v2-space-8)',
          }}
        >
          <CareCardView data={data} />
          <p
            style={{
              marginTop: 'var(--v2-space-4)',
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-surface-explanatory-muted)',
              textAlign: 'center',
            }}
          >
            This card is meant to print as a single page. For a
            shareable read-only link, use the legacy route for now.
          </p>
        </div>
      </div>
    </MobileShell>
  )
}
