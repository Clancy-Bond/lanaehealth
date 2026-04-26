/*
 * /v2/insurance/[slug] (server component)
 *
 * Catch-all carrier guide page. Renders the CarrierGuide for any
 * slug present in CARRIER_CATALOG (_data/carriers.ts). One file
 * gets us 12 pages: UnitedHealthcare, Anthem BCBS, Aetna, Cigna,
 * Humana, Kaiser Permanente, Molina, Centene/Ambetter, Highmark,
 * Independence Blue Cross, Medicare, Medicaid.
 *
 * The HMSA QUEST page predates this catalog and lives at its own
 * route (/v2/insurance/hmsa-quest). That route is unchanged.
 *
 * If the slug does not exist in the catalog, we 404 via Next.js
 * `notFound()`. This protects against typos in deep-links from
 * the hub.
 *
 * Voice: NC short, kind, explanatory. No em-dashes anywhere.
 */
import { notFound } from 'next/navigation'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import BackChevron from '../_components/BackChevron'
import CarrierGuide from '../_components/CarrierGuide'
import { CARRIER_SLUGS, getCarrier } from '../_data/carriers'

export const dynamic = 'force-static'

export function generateStaticParams() {
  return CARRIER_SLUGS.map((slug) => ({ slug }))
}

export default async function CarrierGuidePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const carrier = getCarrier(slug)
  if (!carrier) {
    notFound()
  }

  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title={carrier.label}
          leading={<BackChevron href="/v2/insurance" label="Back to insurance hub" />}
        />
      }
    >
      <CarrierGuide carrier={carrier} />
    </MobileShell>
  )
}
