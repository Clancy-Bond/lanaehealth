import Link from 'next/link'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import CustomFoodForm from './_components/CustomFoodForm'

export const metadata = { title: 'New custom food - LanaeHealth' }
export const dynamic = 'force-dynamic'

export default function NewCustomFoodPage() {
  return (
    <MobileShell
      top={
        <TopAppBar
          title="New custom food"
          leading={
            <Link
              href="/v2/calories/search?view=custom"
              aria-label="Back to custom foods"
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
              ‹ Custom
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
        <CustomFoodForm />
      </div>
    </MobileShell>
  )
}
