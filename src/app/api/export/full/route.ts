// ---------------------------------------------------------------------------
// GET /api/export/full  -- Full ZIP export (Wave 2e F10)
//
// Builds a single ZIP containing every major health table as CSV plus
// the semi-structured JSON tables (chat_messages, health_profile) and a
// README explaining the schema. This is the "over-delivery" response to
// Clue's CSV-only export: Lanae's data is Supabase-local, so we can hand
// her a complete, portable archive.
//
// AUTHENTICATION (REQUIRED):
// The route requires a matching EXPORT_ADMIN_TOKEN header or query
// parameter. The ZIP potentially contains every symptom entry, every
// lab value, every chat message, and every food entry the patient has
// logged -- an unauthenticated viewer MUST NOT be able to retrieve it.
// This mirrors the SHARE_TOKEN_ADMIN_TOKEN guard at
// /api/share/care-card and the CHAT_HARD_DELETE_TOKEN guard at
// /api/chat/history. Once the app grows a real user auth layer this
// guard can be upgraded.
//
// CONFIGURATION:
//   EXPORT_ADMIN_TOKEN   required; disables export if unset.
//
// Returns:
//   Content-Type: application/zip
//   Content-Disposition: attachment; filename="lanaehealth-full-<date>.zip"
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { createServiceClient } from '@/lib/supabase'
import { format } from 'date-fns'
import { checkRateLimit, clientIdFromRequest } from '@/lib/security/rate-limit'
import { recordAuditEvent, auditMetaFromRequest } from '@/lib/security/audit-log'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// --- auth helper -----------------------------------------------------------

function extractAdminToken(req: NextRequest): string | null {
  const header = req.headers.get('x-export-admin-token')
  if (header) return header
  const fromQuery = req.nextUrl.searchParams.get('token')
  if (fromQuery) return fromQuery
  return null
}

// --- csv serializer --------------------------------------------------------

/**
 * Serialize an array of rows to RFC-4180 compliant CSV.
 *
 * Rules:
 *   - Columns are the union of keys across all rows (preserves order of
 *     first appearance). Missing values serialize to empty cells.
 *   - Values that contain a comma, quote, newline, or carriage return
 *     are wrapped in double quotes with internal quotes doubled.
 *   - null and undefined serialize to empty cells.
 *   - Objects and arrays serialize to JSON so nested data survives the
 *     round-trip back into a database.
 *
 * Exported for unit testing.
 */
export function rowsToCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows || rows.length === 0) return ''

  const columns: string[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key)
        columns.push(key)
      }
    }
  }

  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return ''
    let s: string
    if (typeof value === 'object') {
      try {
        s = JSON.stringify(value)
      } catch {
        s = String(value)
      }
    } else {
      s = String(value)
    }
    // CSV formula injection neutralization: prefix dangerous leading
    // characters with an apostrophe so Excel / Sheets treat the cell as
    // literal text instead of a formula. OWASP CSV Injection.
    if (s.length > 0) {
      const first = s.charAt(0)
      if (first === '=' || first === '+' || first === '-' || first === '@' || first === '\t' || first === '\r') {
        s = `'${s}`
      }
    }
    if (/[",\r\n]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  const lines: string[] = []
  lines.push(columns.map((c) => escape(c)).join(','))
  for (const row of rows) {
    lines.push(columns.map((c) => escape(row[c])).join(','))
  }
  return lines.join('\r\n') + '\r\n'
}

// --- table registry --------------------------------------------------------

/**
 * Every table we include in the export. CSV for tabular data, JSON for
 * EAV / semi-structured tables. orderBy helps reviewers skim chronological
 * tables like daily_logs.
 */
interface TableSpec {
  name: string
  format: 'csv' | 'json'
  orderBy?: { column: string; ascending: boolean }
}

const TABLES: TableSpec[] = [
  // Tabular -> CSV
  { name: 'daily_logs', format: 'csv', orderBy: { column: 'date', ascending: false } },
  { name: 'oura_daily', format: 'csv', orderBy: { column: 'date', ascending: false } },
  { name: 'nc_imported', format: 'csv', orderBy: { column: 'date', ascending: false } },
  { name: 'food_entries', format: 'csv', orderBy: { column: 'logged_at', ascending: false } },
  { name: 'lab_results', format: 'csv', orderBy: { column: 'date', ascending: false } },
  { name: 'symptoms', format: 'csv', orderBy: { column: 'created_at', ascending: false } },
  { name: 'pain_points', format: 'csv', orderBy: { column: 'created_at', ascending: false } },
  { name: 'appointments', format: 'csv', orderBy: { column: 'date', ascending: false } },
  { name: 'medical_timeline', format: 'csv', orderBy: { column: 'event_date', ascending: false } },
  { name: 'cycle_entries', format: 'csv', orderBy: { column: 'date', ascending: false } },
  { name: 'imaging_studies', format: 'csv', orderBy: { column: 'study_date', ascending: false } },
  { name: 'active_problems', format: 'csv', orderBy: { column: 'created_at', ascending: false } },
  { name: 'correlation_results', format: 'csv', orderBy: { column: 'created_at', ascending: false } },
  // Semi-structured / EAV -> JSON
  { name: 'chat_messages', format: 'json', orderBy: { column: 'created_at', ascending: true } },
  { name: 'health_profile', format: 'json', orderBy: { column: 'section', ascending: true } },
  { name: 'medical_narrative', format: 'json', orderBy: { column: 'section_order', ascending: true } },
]

// --- README content --------------------------------------------------------

/**
 * Schema readme bundled inside the ZIP so Lanae (or any future import
 * tool) has a standalone reference. This is intentionally verbose.
 */
function buildReadme(
  exportDate: string,
  counts: Record<string, number>,
): string {
  const totalRecords = Object.values(counts).reduce((sum, n) => sum + n, 0)

  const tableDescriptions: Array<[string, string]> = [
    ['daily_logs.csv', 'One row per calendar day. Energy, pain, fatigue, sleep flag, mood flag. Foreign key for symptoms/food/mood/sleep_details/gratitude.'],
    ['oura_daily.csv', 'One row per day from the Oura Ring API. Sleep score, readiness, HRV, resting HR, body temperature deviation, activity.'],
    ['nc_imported.csv', 'One row per day from Natural Cycles. Cycle phase, temperature, ovulation flag, period flag.'],
    ['food_entries.csv', 'Every meal logged (MyNetDiary + manual). Macronutrients, timestamp, meal type.'],
    ['lab_results.csv', 'Every lab test result with reference range, flag (H/L/abnormal), ordering provider.'],
    ['symptoms.csv', 'Symptom entries keyed to daily_logs via daily_log_id. Includes severity and condition tag.'],
    ['pain_points.csv', 'Pain-specific entries with body location, quality, triggers.'],
    ['appointments.csv', 'Past and upcoming medical appointments, provider, specialty.'],
    ['medical_timeline.csv', 'Key medical events (diagnoses, procedures, hospitalizations) with event_date.'],
    ['cycle_entries.csv', 'Manual cycle tracking entries (distinct from nc_imported).'],
    ['imaging_studies.csv', 'Imaging studies (CT, MRI, X-ray, ultrasound) with modality and study_date.'],
    ['active_problems.csv', 'Currently unresolved medical issues flagged for tracking.'],
    ['correlation_results.csv', 'Output of the correlation engine: significant symptom <-> driver pairs with statistical measures.'],
    ['chat_messages.json', 'Full assistant chat history as JSON. Each row has role, content (string or array), tokens_used, model, timestamp.'],
    ['health_profile.json', 'Structured health profile as JSON (EAV pattern). One row per section (personal, family_history, immunizations, etc.) with content blob.'],
    ['medical_narrative.json', 'Long-form narrative sections organized by section_order.'],
  ]

  const countRows = tableDescriptions
    .map(([file]) => {
      const name = file.replace(/\.(csv|json)$/, '')
      const n = counts[name] ?? 0
      return `| ${file.padEnd(30)} | ${String(n).padStart(10)} |`
    })
    .join('\n')

  const descriptionRows = tableDescriptions
    .map(([file, desc]) => `### ${file}\n\n${desc}\n`)
    .join('\n')

  return `# LanaeHealth Full Data Export

Exported: ${exportDate}
Total records: ${totalRecords}

This archive is a portable snapshot of every tracked table in LanaeHealth.
CSV files are RFC-4180 compliant (CRLF line endings, quotes for embedded
commas/newlines, doubled quotes for embedded quotes). JSON files are
pretty-printed for human review.

## Purpose

This export is designed for portability. If you want to:

1. **Switch to another health tracker** -- the CSVs can be imported into
   Bearable, Symple, Apple Health (via a converter), or rolled into a
   research database.
2. **Share data with a provider** -- zip + attach to a portal message.
3. **Back up locally** -- every row your app has stored is in this
   archive; nothing is held back.
4. **Audit what AI has seen** -- chat_messages.json is the full record
   of every turn.

## Provenance

| Source                   | Arrives In             |
|--------------------------|------------------------|
| Oura Ring API            | oura_daily.csv         |
| Natural Cycles export    | nc_imported.csv        |
| MyNetDiary               | food_entries.csv       |
| myAH / Luminate portal   | lab_results.csv, appointments.csv, medical_timeline.csv |
| Manual in-app logging    | daily_logs.csv, symptoms.csv, pain_points.csv, cycle_entries.csv |
| Correlation engine       | correlation_results.csv |
| PACS imaging import      | imaging_studies.csv     |

## Counts

| File                           |    Records |
|--------------------------------|-----------:|
${countRows}

## Files

${descriptionRows}

## Primary keys and joins

- \`daily_logs.id\` is the linchpin. \`symptoms\`, \`food_entries\`,
  \`mood_entries\`, \`sleep_details\`, and \`gratitude_entries\` all
  carry a \`daily_log_id\` that references it.
- Dates are stored as \`date\` (YYYY-MM-DD) on daily tables and as
  \`timestamptz\` (ISO-8601 UTC) on event tables.
- Empty cells in CSVs are genuinely NULL in the database. Zero is NOT
  the same as unknown.

## Privacy

- allow_claude_context, allow_correlation_analysis, and
  retain_history_beyond_2y preferences live in the privacy_prefs table
  (not exported here, since they describe the export itself).
- When allow_claude_context is false, no patient data is sent to the
  Claude API; only the static system prompt is transmitted.

## Re-import sketch

Each CSV can be loaded into a Postgres table with the same name via
\`COPY\` once the schema has been recreated. The source DDL for every
table lives at \`src/lib/migrations/*.sql\` in the LanaeHealth repo.

---
Generated by /api/export/full in LanaeHealth.
`
}

// --- route handler ---------------------------------------------------------

export async function GET(req: NextRequest) {
  const audit = auditMetaFromRequest(req)

  try {
    // -- Auth check --
    const expected = process.env.EXPORT_ADMIN_TOKEN
    if (!expected) {
      return NextResponse.json(
        {
          error:
            'EXPORT_ADMIN_TOKEN is not configured on the server; full export is disabled',
        },
        { status: 401 },
      )
    }
    const provided = extractAdminToken(req)
    if (!provided || provided !== expected) {
      await recordAuditEvent({
        endpoint: 'GET /api/export/full',
        actor: audit.ip ?? 'unauthenticated',
        outcome: 'deny',
        status: 401,
        reason: 'auth',
        ip: audit.ip,
        userAgent: audit.userAgent,
      })
      return NextResponse.json(
        {
          error:
            'full export requires a matching admin token (header x-export-admin-token or ?token=)',
        },
        { status: 401 },
      )
    }

    // Full export is extremely expensive (every table, CSV-serialized,
    // gzipped). Cap at one call per hour per client to prevent thrash.
    const limit = checkRateLimit({
      scope: 'export:full',
      max: 1,
      windowMs: 60 * 60 * 1000,
      key: clientIdFromRequest(req),
    })
    if (!limit.ok) {
      await recordAuditEvent({
        endpoint: 'GET /api/export/full',
        actor: 'admin-token',
        outcome: 'deny',
        status: 429,
        reason: 'rate-limit',
        ip: audit.ip,
        userAgent: audit.userAgent,
      })
      return NextResponse.json(
        { error: 'Full export is rate-limited to 1 per hour.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } },
      )
    }

    const supabase = createServiceClient()
    const zip = new JSZip()
    const counts: Record<string, number> = {}
    const errors: Array<{ table: string; error: string }> = []

    // Fetch every table sequentially to avoid saturating the connection
    // pool with 16 concurrent SELECT *. Each table is small enough to
    // finish in under a second.
    for (const spec of TABLES) {
      let query = supabase.from(spec.name).select('*')
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
        const csv = rowsToCsv(rows)
        zip.file(`${spec.name}.csv`, csv)
      } else {
        zip.file(`${spec.name}.json`, JSON.stringify(rows, null, 2))
      }
    }

    // README
    const exportDate = format(new Date(), "yyyy-MM-dd'T'HH:mm:ssXXX")
    zip.file('README.md', buildReadme(exportDate, counts))

    // Manifest (machine-readable version of the README summary)
    const manifest = {
      app: 'LanaeHealth',
      version: '1.0.0',
      exported_at: exportDate,
      record_counts: counts,
      total_records: Object.values(counts).reduce((sum, n) => sum + n, 0),
      errors: errors.length > 0 ? errors : undefined,
    }
    zip.file('manifest.json', JSON.stringify(manifest, null, 2))

    const buf = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    })

    const filename = `lanaehealth-full-${format(new Date(), 'yyyy-MM-dd')}.zip`

    await recordAuditEvent({
      endpoint: 'GET /api/export/full',
      actor: 'admin-token',
      outcome: 'allow',
      status: 200,
      bytes: buf.length,
      ip: audit.ip,
      userAgent: audit.userAgent,
      meta: { record_counts: manifest.record_counts, total_records: manifest.total_records },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new NextResponse(buf as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buf.length),
      },
    })
  } catch (err) {
    console.error('[export/full] failed:', err)
    await recordAuditEvent({
      endpoint: 'GET /api/export/full',
      actor: 'admin-token',
      outcome: 'error',
      status: 500,
      reason: 'generation',
      ip: audit.ip,
      userAgent: audit.userAgent,
    })
    return NextResponse.json({ error: 'Full export failed' }, { status: 500 })
  }
}
