import Link from 'next/link'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import RecipeBuilderForm from './_components/RecipeBuilderForm'

export const metadata = { title: 'New recipe - LanaeHealth' }
export const dynamic = 'force-dynamic'

export default function NewRecipePage() {
  return (
    <MobileShell
      top={
        <TopAppBar
          title="New recipe"
          leading={
            <Link
              href="/v2/calories/search?view=my-recipes"
              aria-label="Back to my recipes"
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
              ‹ Recipes
            </Link>
          }
        />
      }
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-5)',
          padding: 'var(--v2-space-4)',
          paddingBottom: 'var(--v2-space-12)',
          maxWidth: 640,
          margin: '0 auto',
          width: '100%',
        }}
      >
        <RecipeBuilderForm />
      </div>
    </MobileShell>
  )
}
