import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { Card } from '@/v2/components/primitives'
import { PostVisitForm } from '@/components/doctor/PostVisitForm'
import type { Appointment } from '@/lib/types'

export const dynamic = 'force-dynamic'

interface V2PostVisitPageProps {
  searchParams: Promise<{ id?: string }>
}

/*
 * /v2/doctor/post-visit
 *
 * Lighter-polish per spec (rated monthly, not per-visit). Wraps the
 * legacy PostVisitForm inside the v2 shell. The form itself stays
 * functional and identical; we just give it a v2 top-bar and a
 * framed container. A future pass could re-skin the form fields.
 */
export default async function V2PostVisitPage({ searchParams }: V2PostVisitPageProps) {
  const { id } = await searchParams
  if (!id) redirect('/v2/doctor')

  const sb = createServiceClient()
  const { data } = await sb.from('appointments').select('*').eq('id', id).maybeSingle()
  const appt = (data as Appointment | null) ?? null
  if (!appt) redirect('/v2/doctor')

  return (
    <MobileShell
      top={
        <TopAppBar
          title="Post-visit notes"
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
      <div
        style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: 'var(--v2-space-4)',
          paddingBottom: 'var(--v2-space-8)',
        }}
      >
        <Card padding="md" variant="explanatory">
          <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', lineHeight: 'var(--v2-leading-relaxed)' }}>
            A few minutes capturing what you heard at the visit keeps
            the timeline current. It also sets up the &ldquo;since last
            visit&rdquo; panel for the next appointment.
          </p>
        </Card>
        <div style={{ marginTop: 'var(--v2-space-4)' }}>
          <PostVisitForm appointment={appt} />
        </div>
      </div>
    </MobileShell>
  )
}
