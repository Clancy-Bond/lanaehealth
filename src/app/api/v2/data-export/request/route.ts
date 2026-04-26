// ---------------------------------------------------------------------------
// POST /api/v2/data-export/request
//
// GDPR-style data portability for the v2 multi-user surface. Streams a
// single ZIP containing:
//
//   - One CSV per tabular PHI table (filtered by user_id)
//   - One JSON per semi-structured table (full row dumps)
//   - One README.md describing the schema and provenance
//   - One health-summary.json with key metrics for quick review
//
// Differences from the legacy /api/export/full route (which we keep for
// the iOS Shortcut + cron tooling):
//
//   - Cookie-based session auth (Supabase) only; no APP_AUTH_TOKEN
//     bearer fallback. The v2 surface has real users.
//   - Persistent rate limit via data_export_log (1 per 24h per user) on
//     top of the in-memory bucket so a lambda cold-start cannot bypass.
//   - Audit trail row written to data_export_log with completion status
//     and byte count. The security_audit_log row is still written for
//     the cross-cutting endpoint trail.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { createServiceClient } from '@/lib/supabase'
import { format } from 'date-fns'
import { resolveUserId, UserIdUnresolvableError } from '@/lib/auth/resolve-user-id'
import { checkRateLimit, clientIdFromRequest } from '@/lib/security/rate-limit'
import { recordAuditEvent, auditMetaFromRequest } from '@/lib/security/audit-log'
import { rowsToCsv } from '@/app/api/export/full/route'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// --- table registry --------------------------------------------------------

interface TableSpec {
  name: string
  format: 'csv' | 'json'
  orderBy?: { column: string; ascending: boolean }
  /** Human-friendly category label surfaced in the UI listing. */
  category: string
  /** One-sentence description, shown in the README and the listing. */
  description: string
}

const TABLES: TableSpec[] = [
  {
    name: 'daily_logs',
    format: 'csv',
    orderBy: { column: 'date', ascending: false },
    category: 'Daily logs',
    description: 'One row per calendar day. Energy, pain, fatigue, mood, sleep flag.',
  },
  {
    name: 'symptoms',
    format: 'csv',
    orderBy: { column: 'created_at', ascending: false },
    category: 'Symptoms',
    description: 'Symptom entries linked to daily logs with severity and condition tag.',
  },
  {
    name: 'pain_points',
    format: 'csv',
    orderBy: { column: 'created_at', ascending: false },
    category: 'Symptoms',
    description: 'Pain entries with body location, quality, and triggers.',
  },
  {
    name: 'cycle_entries',
    format: 'csv',
    orderBy: { column: 'date', ascending: false },
    category: 'Cycle',
    description: 'Manual cycle tracking entries.',
  },
  {
    name: 'nc_imported',
    format: 'csv',
    orderBy: { column: 'date', ascending: false },
    category: 'Cycle',
    description: 'Cycle data imported from Natural Cycles.',
  },
  {
    name: 'food_entries',
    format: 'csv',
    orderBy: { column: 'logged_at', ascending: false },
    category: 'Food and nutrition',
    description: 'Every meal logged with macronutrients and timestamp.',
  },
  {
    name: 'lab_results',
    format: 'csv',
    orderBy: { column: 'date', ascending: false },
    category: 'Labs and imaging',
    description: 'Lab tests with reference range, abnormality flag, and ordering provider.',
  },
  {
    name: 'imaging_studies',
    format: 'csv',
    orderBy: { column: 'study_date', ascending: false },
    category: 'Labs and imaging',
    description: 'Imaging studies with modality and study date.',
  },
  {
    name: 'oura_daily',
    format: 'csv',
    orderBy: { column: 'date', ascending: false },
    category: 'Wearables',
    description: 'Daily Oura Ring readings: sleep score, HRV, resting HR, temperature deviation.',
  },
  {
    name: 'appointments',
    format: 'csv',
    orderBy: { column: 'date', ascending: false },
    category: 'Care',
    description: 'Past and upcoming medical appointments.',
  },
  {
    name: 'medical_timeline',
    format: 'csv',
    orderBy: { column: 'event_date', ascending: false },
    category: 'Care',
    description: 'Key medical events: diagnoses, procedures, hospitalizations.',
  },
  {
    name: 'active_problems',
    format: 'csv',
    orderBy: { column: 'created_at', ascending: false },
    category: 'Care',
    description: 'Currently unresolved medical issues flagged for tracking.',
  },
  {
    name: 'correlation_results',
    format: 'csv',
    orderBy: { column: 'created_at', ascending: false },
    category: 'Insights',
    description: 'Significant symptom-driver pairs from the correlation engine.',
  },
  {
    name: 'chat_messages',
    format: 'json',
    orderBy: { column: 'created_at', ascending: true },
    category: 'AI conversations',
    description: 'Full assistant chat history. Each row has role, content, model, timestamp.',
  },
  {
    name: 'health_profile',
    format: 'json',
    orderBy: { column: 'section', ascending: true },
    category: 'Profile',
    description: 'Structured health profile sections (allergies, medications, family history).',
  },
  {
    name: 'medical_narrative',
    format: 'json',
    orderBy: { column: 'section_order', ascending: true },
    category: 'Profile',
    description: 'Long-form narrative sections organized by section_order.',
  },
]

// --- README ----------------------------------------------------------------

function buildReadme(exportDate: string, counts: Record<string, number>): string {
  const totalRecords = Object.values(counts).reduce((sum, n) => sum + n, 0)

  const countRows = TABLES.map((spec) => {
    const file = `${spec.name}.${spec.format}`
    const n = counts[spec.name] ?? 0
    return `| ${file.padEnd(30)} | ${spec.category.padEnd(22)} | ${String(n).padStart(10)} |`
  }).join('\n')

  const descriptionRows = TABLES.map(
    (spec) => `### ${spec.name}.${spec.format}\n\nCategory: ${spec.category}.\n\n${spec.description}\n`,
  ).join('\n')

  return `# LanaeHealth Data Export

Exported: ${exportDate}
Total records: ${totalRecords}

This archive is your full, portable health record. Every PHI table that
LanaeHealth stores about you is included. CSV files are RFC-4180
compliant. JSON files are pretty-printed for human review.

## Why we built this

Your data belongs to you. This export is the "take it with you" promise:
download once and you can switch trackers, share with a provider, audit
what the AI has seen, or back up locally.

## What is in here

| File                           | Category               |    Records |
|--------------------------------|------------------------|-----------:|
${countRows}

## Files in detail

${descriptionRows}

## Primary keys and joins

- daily_logs.id is the linchpin. symptoms, food_entries, mood_entries,
  sleep_details, and gratitude_entries all carry a daily_log_id that
  references it.
- Dates are stored as date (YYYY-MM-DD) on daily tables and as
  timestamptz (ISO-8601 UTC) on event tables.
- Empty cells in CSVs are genuinely NULL in the database. Zero is NOT
  the same as unknown.

## Privacy choices

The privacy_prefs table is not exported here because it describes how
the export itself behaves. When allow_claude_context is false, no PHI is
sent to the Claude API; only the static system prompt is transmitted.

## Re-importing

Each CSV can be loaded into a Postgres table with the same name via
COPY once the schema has been recreated. The source DDL for every table
lives at src/lib/migrations/*.sql in the LanaeHealth repo.

---
Generated by /api/v2/data-export/request in LanaeHealth.
`
}

// --- table registry surface (for the UI) -----------------------------------

/** Public listing of categories + tables, surfaced by GET to drive the UI. */
export interface ExportCatalogEntry {
  category: string
  tables: Array<{ name: string; format: 'csv' | 'json'; description: string }>
}

function buildCatalog(): ExportCatalogEntry[] {
  const map = new Map<string, ExportCatalogEntry>()
  for (const spec of TABLES) {
    let entry = map.get(spec.category)
    if (!entry) {
      entry = { category: spec.category, tables: [] }
      map.set(spec.category, entry)
    }
    entry.tables.push({ name: spec.name, format: spec.format, description: spec.description })
  }
  return Array.from(map.values())
}

// --- daily limit check -----------------------------------------------------

interface LastExportResult {
  ok: boolean
  retryAfterSeconds?: number
  lastRequestedAt?: string
}

async function checkDailyLimit(userId: string): Promise<LastExportResult> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('data_export_log')
    .select('requested_at, status')
    .eq('user_id', userId)
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    // Fail open if the table is missing in older environments. The
    // in-memory rate limiter still applies.
    const msg = (error.message || '').toLowerCase()
    if (msg.includes('data_export_log') && msg.includes('does not exist')) {
      return { ok: true }
    }
    console.warn('[data-export] daily-limit lookup failed:', error.message)
    return { ok: true }
  }

  if (!data) return { ok: true }

  // A failed export does not consume the daily slot.
  if (data.status === 'failed') return { ok: true }

  const lastRequestedAt = data.requested_at as string
  const elapsedMs = Date.now() - new Date(lastRequestedAt).getTime()
  const oneDayMs = 24 * 60 * 60 * 1000
  if (elapsedMs >= oneDayMs) return { ok: true }
  return {
    ok: false,
    retryAfterSeconds: Math.ceil((oneDayMs - elapsedMs) / 1000),
    lastRequestedAt,
  }
}

// --- log writers -----------------------------------------------------------

async function logExportRequested(
  userId: string,
  ip: string | null,
  userAgent: string | null,
): Promise<string | null> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('data_export_log')
      .insert({ user_id: userId, status: 'pending', ip, user_agent: userAgent })
      .select('id')
      .single()
    if (error) {
      const msg = (error.message || '').toLowerCase()
      if (msg.includes('data_export_log') && msg.includes('does not exist')) {
        console.warn('[data-export] table missing; export will not be persisted until migration 044 is applied.')
        return null
      }
      console.warn('[data-export] insert failed:', error.message)
      return null
    }
    return (data?.id as string | undefined) ?? null
  } catch (err) {
    console.warn('[data-export] insert threw:', err instanceof Error ? err.message : String(err))
    return null
  }
}

async function logExportCompleted(
  rowId: string,
  fileSizeBytes: number,
): Promise<void> {
  try {
    const supabase = createServiceClient()
    await supabase
      .from('data_export_log')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        file_size_bytes: fileSizeBytes,
      })
      .eq('id', rowId)
  } catch (err) {
    console.warn('[data-export] complete update failed:', err instanceof Error ? err.message : String(err))
  }
}

async function logExportFailed(rowId: string, reason: string): Promise<void> {
  try {
    const supabase = createServiceClient()
    await supabase
      .from('data_export_log')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        failure_reason: reason.slice(0, 500),
      })
      .eq('id', rowId)
  } catch (err) {
    console.warn('[data-export] failure update failed:', err instanceof Error ? err.message : String(err))
  }
}

// --- GET: catalog + last export status -------------------------------------

export async function GET() {
  let userId: string
  try {
    userId = (await resolveUserId()).userId
  } catch (err) {
    if (err instanceof UserIdUnresolvableError) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }
    return NextResponse.json({ error: 'auth check failed' }, { status: 500 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('data_export_log')
    .select('requested_at, completed_at, file_size_bytes, status')
    .eq('user_id', userId)
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Fail open on the lookup; the catalog is the priority.
  const lastExport =
    data && !error
      ? {
          requestedAt: data.requested_at as string,
          completedAt: (data.completed_at as string | null) ?? null,
          fileSizeBytes: (data.file_size_bytes as number | null) ?? null,
          status: data.status as 'pending' | 'completed' | 'failed',
        }
      : null

  return NextResponse.json({
    catalog: buildCatalog(),
    lastExport,
    rateLimit: { window: '24h', maxPerWindow: 1 },
  })
}

// --- POST: build and stream the export ZIP ---------------------------------

export async function POST(req: NextRequest) {
  const audit = auditMetaFromRequest(req)

  // 1. Resolve user.
  let userId: string
  try {
    userId = (await resolveUserId()).userId
  } catch (err) {
    await recordAuditEvent({
      endpoint: 'POST /api/v2/data-export/request',
      actor: audit.ip ?? 'unauthenticated',
      outcome: 'deny',
      status: 401,
      reason: 'auth',
      ip: audit.ip,
      userAgent: audit.userAgent,
    })
    if (err instanceof UserIdUnresolvableError) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }
    return NextResponse.json({ error: 'auth check failed' }, { status: 500 })
  }

  // 2. In-memory rate limit. Catches accidental double-taps and trivial
  //    automation loops without a DB round trip.
  const limit = checkRateLimit({
    scope: 'v2:data-export',
    max: 1,
    windowMs: 60 * 60 * 1000,
    key: clientIdFromRequest(req),
  })
  if (!limit.ok) {
    await recordAuditEvent({
      endpoint: 'POST /api/v2/data-export/request',
      actor: `user:${userId}`,
      outcome: 'deny',
      status: 429,
      reason: 'rate-limit-memory',
      ip: audit.ip,
      userAgent: audit.userAgent,
    })
    return NextResponse.json(
      { error: 'Please wait a moment before requesting another export.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } },
    )
  }

  // 3. Persistent 24h limit per user. Survives lambda cold starts.
  const daily = await checkDailyLimit(userId)
  if (!daily.ok) {
    await recordAuditEvent({
      endpoint: 'POST /api/v2/data-export/request',
      actor: `user:${userId}`,
      outcome: 'deny',
      status: 429,
      reason: 'rate-limit-daily',
      ip: audit.ip,
      userAgent: audit.userAgent,
    })
    return NextResponse.json(
      {
        error: 'You can request one full export per day. Please try again tomorrow.',
        retryAfterSeconds: daily.retryAfterSeconds,
        lastRequestedAt: daily.lastRequestedAt,
      },
      {
        status: 429,
        headers: { 'Retry-After': String(daily.retryAfterSeconds ?? 86400) },
      },
    )
  }

  // 4. Reserve the slot in data_export_log. If the row insert fails the
  //    export still proceeds (we never want auditing failure to block a
  //    user-requested export), but the warning is logged.
  const exportRowId = await logExportRequested(userId, audit.ip, audit.userAgent)

  // 5. Build the ZIP.
  try {
    const supabase = createServiceClient()
    const zip = new JSZip()
    const counts: Record<string, number> = {}
    const errors: Array<{ table: string; error: string }> = []

    for (const spec of TABLES) {
      let query = supabase.from(spec.name).select('*').eq('user_id', userId)
      if (spec.orderBy) {
        query = query.order(spec.orderBy.column, { ascending: spec.orderBy.ascending })
      }
      const { data, error } = await query
      if (error) {
        errors.push({ table: spec.name, error: error.message })
        counts[spec.name] = 0
        continue
      }
      const rows = (data || []) as Array<Record<string, unknown>>
      counts[spec.name] = rows.length
      if (spec.format === 'csv') {
        zip.file(`${spec.name}.csv`, rowsToCsv(rows))
      } else {
        zip.file(`${spec.name}.json`, JSON.stringify(rows, null, 2))
      }
    }

    const exportDate = format(new Date(), "yyyy-MM-dd'T'HH:mm:ssXXX")
    zip.file('README.md', buildReadme(exportDate, counts))

    const totalRecords = Object.values(counts).reduce((sum, n) => sum + n, 0)
    const summary = {
      app: 'LanaeHealth',
      version: '1.0.0',
      exported_at: exportDate,
      user_id: userId,
      record_counts: counts,
      total_records: totalRecords,
      partial_failures: errors.length > 0 ? errors : undefined,
    }
    zip.file('health-summary.json', JSON.stringify(summary, null, 2))

    const buf = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    })

    if (exportRowId) await logExportCompleted(exportRowId, buf.length)

    await recordAuditEvent({
      endpoint: 'POST /api/v2/data-export/request',
      actor: `user:${userId}`,
      outcome: 'allow',
      status: 200,
      bytes: buf.length,
      ip: audit.ip,
      userAgent: audit.userAgent,
      meta: { record_counts: counts, total_records: totalRecords },
    })

    const filename = `lanaehealth-export-${format(new Date(), 'yyyy-MM-dd')}.zip`
    const ab = new ArrayBuffer(buf.byteLength)
    new Uint8Array(ab).set(buf)
    return new NextResponse(new Uint8Array(ab), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buf.length),
      },
    })
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    console.error('[data-export] failed:', err)
    if (exportRowId) await logExportFailed(exportRowId, reason)
    await recordAuditEvent({
      endpoint: 'POST /api/v2/data-export/request',
      actor: `user:${userId}`,
      outcome: 'error',
      status: 500,
      reason: 'generation',
      ip: audit.ip,
      userAgent: audit.userAgent,
    })
    return NextResponse.json({ error: 'Export failed. Please try again.' }, { status: 500 })
  }
}
