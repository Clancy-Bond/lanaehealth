/*
 * /v2/settings/data-export
 *
 * GDPR-style data portability surface. Lets the user download every
 * PHI table that LanaeHealth stores about them as a single ZIP.
 *
 * Server component that fetches the export catalog and the user's
 * last-export status, then renders a client card to drive the
 * download. Auth gating is handled by the perimeter middleware; we
 * still check getCurrentUser() so we can show a polite "log in to
 * continue" surface instead of a 500.
 */
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth/get-user'
import { Card } from '@/v2/components/primitives'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import DataExportCard, { type ExportCatalogEntry, type LastExportInfo } from './_components/DataExportCard'

export const dynamic = 'force-dynamic'

const STATIC_CATALOG: ExportCatalogEntry[] = [
  {
    category: 'Daily logs',
    tables: [
      { name: 'daily_logs', format: 'csv', description: 'One row per day. Energy, pain, fatigue, mood.' },
    ],
  },
  {
    category: 'Symptoms',
    tables: [
      { name: 'symptoms', format: 'csv', description: 'Symptom entries with severity and condition tag.' },
      { name: 'pain_points', format: 'csv', description: 'Pain entries with location and triggers.' },
    ],
  },
  {
    category: 'Cycle',
    tables: [
      { name: 'cycle_entries', format: 'csv', description: 'Manual cycle tracking entries.' },
      { name: 'nc_imported', format: 'csv', description: 'Cycle data imported from Natural Cycles.' },
    ],
  },
  {
    category: 'Food and nutrition',
    tables: [
      { name: 'food_entries', format: 'csv', description: 'Every meal logged with macronutrients.' },
    ],
  },
  {
    category: 'Labs and imaging',
    tables: [
      { name: 'lab_results', format: 'csv', description: 'Lab tests with reference range and provider.' },
      { name: 'imaging_studies', format: 'csv', description: 'Imaging studies with modality and date.' },
    ],
  },
  {
    category: 'Wearables',
    tables: [
      { name: 'oura_daily', format: 'csv', description: 'Daily Oura readings: sleep, HRV, resting HR.' },
    ],
  },
  {
    category: 'Care',
    tables: [
      { name: 'appointments', format: 'csv', description: 'Past and upcoming medical appointments.' },
      { name: 'medical_timeline', format: 'csv', description: 'Diagnoses, procedures, hospitalizations.' },
      { name: 'active_problems', format: 'csv', description: 'Currently unresolved medical issues.' },
    ],
  },
  {
    category: 'Insights',
    tables: [
      { name: 'correlation_results', format: 'csv', description: 'Symptom-driver pairs from the engine.' },
    ],
  },
  {
    category: 'AI conversations',
    tables: [
      { name: 'chat_messages', format: 'json', description: 'Full assistant chat history.' },
    ],
  },
  {
    category: 'Profile',
    tables: [
      { name: 'health_profile', format: 'json', description: 'Allergies, medications, family history.' },
      { name: 'medical_narrative', format: 'json', description: 'Long-form narrative sections.' },
    ],
  },
]

async function loadLastExport(userId: string): Promise<LastExportInfo | null> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('data_export_log')
      .select('requested_at, completed_at, file_size_bytes, status')
      .eq('user_id', userId)
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error || !data) return null
    return {
      requestedAt: data.requested_at as string,
      completedAt: (data.completed_at as string | null) ?? null,
      fileSizeBytes: (data.file_size_bytes as number | null) ?? null,
      status: data.status as 'pending' | 'completed' | 'failed',
    }
  } catch {
    return null
  }
}

export default async function DataExportPage() {
  const user = await getCurrentUser()
  const lastExport = user ? await loadLastExport(user.id) : null

  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title="Data export"
          leading={
            <Link
              href="/v2/settings"
              aria-label="Back to settings"
              style={{
                color: 'var(--v2-text-primary)',
                fontSize: 'var(--v2-text-base)',
                textDecoration: 'none',
                padding: 'var(--v2-space-2)',
              }}
            >
              {'< Settings'}
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
          paddingBottom: 'var(--v2-space-8)',
          maxWidth: 640,
          margin: '0 auto',
          width: '100%',
        }}
      >
        <Card variant="explanatory" padding="md">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
            <h2
              style={{
                margin: 0,
                fontSize: 'var(--v2-text-lg)',
                fontWeight: 'var(--v2-weight-semibold)',
              }}
            >
              Download all your health data
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: 'var(--v2-text-sm)',
                lineHeight: 'var(--v2-leading-relaxed)',
              }}
            >
              Your data belongs to you. This export bundles every PHI table we
              store about you into a single ZIP: CSV files for spreadsheets,
              JSON files for richer data, and a README describing the schema.
              You can switch trackers, share with a provider, or back up
              locally.
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 'var(--v2-text-sm)',
                lineHeight: 'var(--v2-leading-relaxed)',
              }}
            >
              The file builds on the server and downloads when ready, usually
              in under a minute. You can request one full export per day.
            </p>
          </div>
        </Card>

        <DataExportCard
          catalog={STATIC_CATALOG}
          lastExport={lastExport}
          authed={!!user}
        />
      </div>
    </MobileShell>
  )
}
