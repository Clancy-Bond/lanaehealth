import Link from 'next/link'
import { format } from 'date-fns'
import { getFoodNutrients, analyzeIronAbsorption, type FoodNutrients } from '@/lib/api/usda-food'
import { isFavorited } from '@/lib/calories/favorites'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { Banner, Card } from '@/v2/components/primitives'
import FoodDetailHero, { FoodDetailProvider } from './_components/FoodDetailHero'
import PortionChipStrip from './_components/PortionChipStrip'
import NutritionFactsCardV2 from './_components/NutritionFactsCardV2'
import AddToMealForm, { type MealType } from './_components/AddToMealForm'

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

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, Math.max(0, max - 1)).trimEnd()}…`
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

function BackLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      aria-label="Back to food search"
      style={{
        color: 'var(--v2-text-secondary)', fontSize: 'var(--v2-text-base)',
        padding: 'var(--v2-space-2)', textDecoration: 'none',
        minHeight: 'var(--v2-touch-target-min)', display: 'inline-flex', alignItems: 'center',
      }}
    >
      ‹ Food
    </Link>
  )
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="22" height="22" viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="1.75" aria-hidden
    >
      <path
        d="M12 21s-7-4.35-7-10a4.5 4.5 0 018-2.83A4.5 4.5 0 0119 11c0 5.65-7 10-7 10z"
        strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )
}

function FavoriteButton({
  fdcId, name, returnTo, isFav,
}: {
  fdcId: number
  name: string
  returnTo: string
  isFav: boolean
}) {
  return (
    <form action="/api/calories/favorites/toggle" method="POST">
      <input type="hidden" name="fdcId" value={fdcId} />
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button
        type="submit"
        aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
        aria-pressed={isFav}
        style={{
          minWidth: 'var(--v2-touch-target-min)', minHeight: 'var(--v2-touch-target-min)',
          padding: 'var(--v2-space-2)', border: 0, background: 'transparent',
          color: isFav ? 'var(--v2-accent-warning)' : 'var(--v2-text-secondary)',
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
          justifyContent: 'center', fontFamily: 'inherit',
        }}
      >
        <HeartIcon filled={isFav} />
      </button>
    </form>
  )
}

function NotFound({ message, meal }: { message: string; meal: MealType }) {
  return (
    <MobileShell
      top={<TopAppBar leading={<BackLink href={`/v2/calories/food?meal=${meal}`} />} title="Not found" />}
    >
      <div
        style={{
          padding: 'var(--v2-space-4)', paddingBottom: 'var(--v2-space-16)',
          display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-4)',
        }}
      >
        <Card padding="md">
          <div
            style={{
              fontSize: 'var(--v2-text-base)', fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)', marginBottom: 'var(--v2-space-2)',
            }}
          >
            Food not found
          </div>
          <p
            style={{
              margin: 0, fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)', lineHeight: 'var(--v2-leading-relaxed)',
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
    loadErr = e instanceof Error ? e.message : 'USDA lookup failed.'
  }
  if (!nutrients) {
    return <NotFound message={loadErr ?? 'We could not find that food.'} meal={meal} />
  }

  const iron = analyzeIronAbsorption(nutrients)
  const isFav = await isFavorited(fdcId).catch(() => false)
  const ironCopy = ironBannerCopy(iron)
  const title = truncate(nutrients.description ?? 'Food', 36)
  const returnTo = `/v2/calories/food/${fdcId}?meal=${meal}&date=${date}`

  return (
    <MobileShell
      top={
        <TopAppBar
          leading={<BackLink href="/v2/calories/food" />}
          title={title}
          trailing={
            <FavoriteButton fdcId={fdcId} name={nutrients.description} returnTo={returnTo} isFav={isFav} />
          }
        />
      }
    >
      <FoodDetailProvider nutrients={nutrients}>
        <div
          style={{
            display: 'flex', flexDirection: 'column',
            gap: 'var(--v2-space-4)', padding: 'var(--v2-space-4)',
            paddingBottom: 'var(--v2-space-16)',
          }}
        >
          <FoodDetailHero brandName={null} />
          <PortionChipStrip />

          <Card padding="md">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
              <span
                style={{
                  fontSize: 'var(--v2-text-xs)', fontWeight: 'var(--v2-weight-semibold)',
                  color: 'var(--v2-text-muted)', textTransform: 'uppercase',
                  letterSpacing: 'var(--v2-tracking-wide)',
                }}
              >
                Meal
              </span>
              <AddToMealForm fdcId={fdcId} date={date} defaultMeal={meal} />
            </div>
          </Card>

          <NutritionFactsCardV2 initialMode="collapsed" />

          {ironCopy && <Banner intent="info" title={ironCopy.title} body={ironCopy.body} />}
        </div>
      </FoodDetailProvider>
    </MobileShell>
  )
}
