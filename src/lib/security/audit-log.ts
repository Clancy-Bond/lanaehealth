// ---------------------------------------------------------------------------
// Security audit log.
//
// Writes a row to the `security_audit_log` table for every access to a
// sensitive PHI endpoint. Designed to be fire-and-forget: logging failures
// MUST NOT break the caller, so the helper swallows errors with a warn.
//
// The schema lives in src/lib/migrations/027_security_audit_log.sql.
// If the table does not exist yet the helper silently no-ops so older
// environments keep working.
// ---------------------------------------------------------------------------

import { createServiceClient } from '@/lib/supabase'

export interface AuditEventInput {
  endpoint: string
  actor: string
  outcome: 'allow' | 'deny' | 'error'
  status: number
  ip?: string | null
  userAgent?: string | null
  bytes?: number | null
  reason?: string | null
  meta?: Record<string, unknown> | null
}

let tableMissing = false

export async function recordAuditEvent(event: AuditEventInput): Promise<void> {
  if (tableMissing) return

  try {
    const supabase = createServiceClient()
    const { error } = await supabase.from('security_audit_log').insert({
      endpoint: event.endpoint,
      actor: event.actor,
      outcome: event.outcome,
      status: event.status,
      ip: event.ip ?? null,
      user_agent: event.userAgent ?? null,
      bytes: event.bytes ?? null,
      reason: event.reason ?? null,
      meta: event.meta ?? null,
    })
    if (error) {
      const msg = (error.message || '').toLowerCase()
      if (msg.includes('security_audit_log') && msg.includes('does not exist')) {
        tableMissing = true
        console.warn('[audit-log] table missing; audit events will not be persisted until migration 027 is applied.')
        return
      }
      console.warn('[audit-log] insert failed:', error.message)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[audit-log] threw:', msg)
  }
}

/** Extract IP + UA pair from a Next.js request for audit entries. */
export function auditMetaFromRequest(req: { headers: { get(name: string): string | null } }): {
  ip: string | null
  userAgent: string | null
} {
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0]?.trim() ?? null : req.headers.get('x-real-ip')
  const userAgent = req.headers.get('user-agent')
  return { ip, userAgent }
}

/** Test-only: reset the cached "table missing" flag. */
export function resetAuditCacheForTests(): void {
  tableMissing = false
}
