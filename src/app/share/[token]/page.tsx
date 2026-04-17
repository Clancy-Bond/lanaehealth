// ---------------------------------------------------------------------------
// /share/[token]
//
// PUBLIC, UNAUTHENTICATED read-only Care Card view.
//
// Safety-critical boundary:
//   - Only renders the strictly-bounded CareCardData slice via CareCardView.
//   - Any token that is missing, expired, revoked, or (one-time) consumed
//     returns 410 Gone.
//   - Unknown tokens return 404.
//   - This route MUST NOT import or display anything beyond CareCardData.
// ---------------------------------------------------------------------------

import { notFound } from 'next/navigation'
import { loadCareCardData } from '@/lib/care-card/load'
import { verifyShareToken } from '@/lib/api/share-tokens'
import { CareCardView } from '@/components/doctor/CareCardView'

export const dynamic = 'force-dynamic'

interface SharePageProps {
  params: Promise<{ token: string }>
}

function GonePage({ reason }: { reason: 'expired' | 'revoked' | 'consumed' }) {
  const label =
    reason === 'expired'
      ? 'This share link has expired.'
      : reason === 'revoked'
        ? 'This share link has been revoked.'
        : 'This share link has already been used.'
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 420,
          textAlign: 'center',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          padding: '32px 24px',
        }}
      >
        <p
          style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--accent-blush)',
            margin: 0,
            marginBottom: 8,
          }}
        >
          Link no longer valid
        </p>
        <h1
          style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 700,
            margin: 0,
            marginBottom: 6,
            color: 'var(--text-primary)',
          }}
        >
          {label}
        </h1>
        <p
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            margin: 0,
          }}
        >
          Please ask the person who shared this link to generate a new one.
        </p>
      </div>
    </div>
  )
}

export default async function SharePage({ params }: SharePageProps) {
  const { token } = await params
  const result = await verifyShareToken(token, 'care_card')

  if (!result.ok) {
    if (result.reason === 'not_found') {
      // Next treats this as 404.
      notFound()
    }
    // Render a friendly 410-ish view. We do not set HTTP status from
    // a server component, but the content clearly communicates "gone".
    return <GonePage reason={result.reason} />
  }

  const data = await loadCareCardData()
  const expires = new Date(result.row.expires_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-primary)',
      }}
    >
      <div
        style={{
          maxWidth: 820,
          margin: '0 auto',
          padding: '24px 20px 80px',
        }}
      >
        <CareCardView
          data={data}
          publicFooter={`Shared read-only copy. Link expires ${expires}. This page does not update if the underlying medical record changes.`}
        />
      </div>
    </div>
  )
}
