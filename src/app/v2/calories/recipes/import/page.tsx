/**
 * /v2/calories/recipes/import
 *
 * Paste a recipe URL from any blog. We parse schema.org/Recipe JSON-LD.
 */

import Link from 'next/link'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import RecipeUrlImportForm from './_components/RecipeUrlImportForm'

export const metadata = { title: 'Import recipe from URL - LanaeHealth' }
export const dynamic = 'force-dynamic'

export default function RecipeImportPage() {
  return (
    <MobileShell
      top={
        <TopAppBar
          title="Import from URL"
          leading={
            <Link
              href="/v2/calories/recipes"
              aria-label="Back to recipes"
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
              Back
            </Link>
          }
        />
      }
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-4)',
          padding: 'var(--v2-space-4)',
          paddingBottom: 'var(--v2-space-12)',
          maxWidth: 640,
          margin: '0 auto',
          width: '100%',
        }}
      >
        <RecipeUrlImportForm />
      </div>
    </MobileShell>
  )
}
