import Link from 'next/link'
import { loadCareCardData } from '@/lib/care-card/load'
import { CareCardView } from '@/components/doctor/CareCardView'
import CareCardPrintActions from './print-actions'

// Always re-fetch; this drives a live safety-critical summary.
export const dynamic = 'force-dynamic'

export default async function CareCardPage() {
  const data = await loadCareCardData()

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-primary)',
      }}
    >
      <div
        className="care-card-wrap"
        style={{
          maxWidth: 820,
          margin: '0 auto',
          padding: '24px 20px 80px',
        }}
      >
        <header
          className="no-print"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 20,
          }}
        >
          <Link
            href="/doctor"
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
              textDecoration: 'none',
            }}
          >
            &larr; Back to Doctor Mode
          </Link>
          <CareCardPrintActions />
        </header>

        <CareCardView data={data} />

        <p
          className="no-print"
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            textAlign: 'center',
            marginTop: 16,
          }}
        >
          Use the Share button to generate a 7-day read-only link for
          paramedics, family, or a new provider. Nothing in the URL itself
          encodes your data.
        </p>
      </div>

      <style>{`
        @media print {
          @page { margin: 10mm; }
          body { background: #ffffff !important; }
          .no-print { display: none !important; }
          nav[aria-label="Main navigation"] { display: none !important; }
          .care-card-wrap { padding: 0 !important; max-width: none !important; }
          .care-card {
            box-shadow: none !important;
            border-radius: 0 !important;
            border: 1px solid #333 !important;
            padding: 14mm 14mm !important;
            max-width: none !important;
          }
        }
      `}</style>
    </div>
  )
}
