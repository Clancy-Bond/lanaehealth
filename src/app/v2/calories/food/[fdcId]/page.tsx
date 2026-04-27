/**
 * /v2/calories/food/[fdcId] - MFN-parity food detail page
 *
 * Layout (top → bottom), mirroring
 * docs/reference/mynetdiary/frames/full-tour/frame_0045.png and 0050:
 *   1. FoodDetailHeader  — edge-to-edge photo banner with name + back/star
 *   2. PortionInputRow   — `[number] unit | [cals]` row
 *   3. PortionChipStrip  — multi-row wrap of unit chips + "Portion Guide"
 *   4. AddToMealForm     — meal text link + green Log pill
 *   5. NutritionFactsCardV2 — Food Macros pie + nutrient table
 *   6. (optional) Iron-absorption banner when relevant
 *
 * The previous design used MobileShell + TopAppBar + a centered
 * 64pt CALORIES headline + tabs + stepper. User feedback 2026-04-27:
 * "this piece is nothing like my net diary." This rewrite replaces
 * the visual chrome wholesale; the data layer (FoodDetailProvider +
 * USDA fetch + photo lookup + iron analysis + favorite read) is
 * unchanged.
 */
import { format } from 'date-fns'
import {
  getFoodNutrients,
  analyzeIronAbsorption,
  UsdaFoodNotFoundError,
  UsdaApiError,
  type FoodNutrients,
} from '@/lib/api/usda-food'
import { lookupFoodPhoto } from '@/lib/api/food-photo'
import { isFavorited } from '@/lib/calories/favorites'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { Banner, Card } from '@/v2/components/primitives'
import Link from 'next/link'
import { FoodDetailProvider } from './_components/FoodDetailHero'
import FoodDetailHeader from './_components/FoodDetailHeader'
import PortionInputRow from './_components/PortionInputRow'
import PortionChipStrip from './_components/PortionChipStrip'
import NutritionFactsCardV2 from './_components/NutritionFactsCardV2'
import AddToMealForm, { type MealType } from './_components/AddToMealForm'
import FoodDetailServingsState from './_components/FoodDetailServingsState'

export const dynamic = 'force-dynamic'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const todayISO = () => format(new Date(), 'yyyy-MM-dd')

function parseDate(raw: string | undefined): string {
  return raw && DATE_RE.test(raw) ? raw : todayISO()
}

function parseMeal(raw: string | undefined): MealType {
  const v = (raw ?? '').toLowerCase()
  if (v === 'lunch' || v === 'dinner' || v === 'snack') return v
  return 'breakfast'
}

type IronContext = ReturnType<typeof analyzeIronAbsorption>

function ironBannerCopy(iron: IronContext): { title: string; body: string } | null {
  if (iron.netAbsorptionScore === 'unknown') return null
  const hasVitC = iron.absorptionEnhancers.includes('Vitamin C')
  const hasCalcium = iron.absorptionInhibitors.includes('Calcium')
  if (iron.netAbsorptionScore === 'high') {
    return {
      title: 'Iron friendly',
      body: hasVitC
        ? 'Nice pairing. The vitamin C here helps your body absorb the iron.'
        : 'This food brings iron in a form your body absorbs well.',
    }
  }
  if (hasCalcium && !hasVitC) {
    return {
      title: 'Worth knowing',
      body: 'A quick note. The calcium here slows iron absorption a bit. Not a problem, just good to know.',
    }
  }
  if (hasVitC) {
    return {
      title: 'Helpful pairing',
      body: 'Nice pairing. The vitamin C here helps your body absorb the iron.',
    }
  }
  return { title: 'Iron note', body: 'Some iron is present. Pair with vitamin C to help absorption.' }
}

function NotFound({ message, meal }: { message: string; meal: MealType }) {
  return (
    <MobileShell
      top={
        <TopAppBar
          leading={
            <Link
              href={`/v2/calories/food?meal=${meal}`}
              aria-label="Back to food search"
              style={{
                color: 'var(--v2-text-secondary)',
                fontSize: 'var(--v2-text-base)',
                padding: 'var(--v2-space-2)',
                textDecoration: 'none',
                minHeight: 'var(--v2-touch-target-min)',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              ‹ Food
            </Link>
          }
          title="Not found"
        />
      }
    >
      <div
        style={{
          padding: 'var(--v2-space-4)',
          paddingBottom: 'var(--v2-space-16)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-4)',
        }}
      >
        <Card padding="md">
          <div
            style={{
              fontSize: 'var(--v2-text-base)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)',
              marginBottom: 'var(--v2-space-2)',
            }}
          >
            Food not found
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            {message}
          </p>
        </Card>
      </div>
    </MobileShell>
  )
}

export default async function V2FoodDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ fdcId: string }>
  searchParams: Promise<{ meal?: string; date?: string }>
}) {
  const { fdcId: fdcIdRaw } = await params
  const sp = await searchParams
  const fdcId = Number(fdcIdRaw)
  const meal = parseMeal(sp.meal)
  const date = parseDate(sp.date)

  if (!Number.isFinite(fdcId) || fdcId <= 0) {
    return <NotFound message="That food id isn't valid." meal={meal} />
  }

  let nutrients: FoodNutrients | null = null
  let loadErr: string | null = null
  try {
    nutrients = await getFoodNutrients(fdcId)
  } catch (e) {
    if (e instanceof UsdaFoodNotFoundError) {
      loadErr =
        "USDA no longer has this food in their database. It may be a retired branded product. Try searching for it again to pick a fresh match."
    } else if (e instanceof UsdaApiError) {
      loadErr =
        'USDA is temporarily unavailable. Please try again in a moment.'
    } else {
      loadErr = e instanceof Error ? e.message : 'We could not look up this food.'
    }
  }
  if (!nutrients) {
    return <NotFound message={loadErr ?? 'We could not find that food.'} meal={meal} />
  }

  const iron = analyzeIronAbsorption(nutrients)
  const isFav = await isFavorited(fdcId).catch(() => false)
  const photo: { url: string | null; source: 'off' | null } =
    await lookupFoodPhoto(fdcId, nutrients.description, nutrients.gtinUpc).catch(
      () => ({ url: null, source: null }),
    )
  const ironCopy = ironBannerCopy(iron)
  const returnTo = `/v2/calories/food/${fdcId}?meal=${meal}&date=${date}`
  const name = nutrients.description ?? 'Food'

  return (
    // No `top` prop: the FoodDetailHeader photo banner is the top
    // chrome on this surface (back chevron + star are inside it).
    // Passing top={undefined} keeps the safe-area handling but skips
    // the TopAppBar so we don't render two top bars stacked.
    <MobileShell>
      <FoodDetailProvider nutrients={nutrients}>
        <FoodDetailHeader
          name={name}
          photoUrl={photo.url}
          backHref={`/v2/calories/food?meal=${meal}`}
          favorite={{ fdcId, name, returnTo, isFav }}
        />
        <FoodDetailServingsState
          fdcId={fdcId}
          date={date}
          defaultMeal={meal}
        />
        <NutritionFactsCardV2 />
        {ironCopy && (
          <div style={{ padding: 'var(--v2-space-4)', background: 'var(--v2-bg-card)' }}>
            <Banner intent="info" title={ironCopy.title} body={ironCopy.body} />
          </div>
        )}
      </FoodDetailProvider>
    </MobileShell>
  )
}
