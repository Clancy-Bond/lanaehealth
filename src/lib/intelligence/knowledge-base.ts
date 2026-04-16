// ---------------------------------------------------------------------------
// Knowledge Base CRUD + Context Loading
// ---------------------------------------------------------------------------

import type { KBDocument, KBDocumentType } from './types'

// Lazy import to avoid triggering Supabase client creation at module scope
// (supabase.ts creates a client at import time, which fails without env vars in tests)
function getSupabase() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createServiceClient } = require('@/lib/supabase') as typeof import('@/lib/supabase')
  return createServiceClient()
}

// ===========================================================================
// Pure utility functions (no DB, testable)
// ===========================================================================

/**
 * Estimate token count from text length.
 * Rough heuristic: ~4 characters per token on average.
 */
export function estimateTokens(text: string): number {
  return Math.round(text.length / 4)
}

/**
 * Format a KBDocument for injection into Claude context.
 *
 * Output format:
 *   ### {title}{staleWarning}{dateRange}
 *   {content}
 */
export function formatKBDocumentForContext(doc: KBDocument): string {
  let header = doc.title

  if (doc.is_stale) {
    header += ' [STALE - may not reflect latest data]'
  }

  if (doc.covers_date_start && doc.covers_date_end) {
    header += ` (${doc.covers_date_start} to ${doc.covers_date_end})`
  }

  return `### ${header}\n${doc.content}`
}

// ===========================================================================
// Priority ordering for context loading
// ===========================================================================

const KB_PRIORITY_ORDER: KBDocumentType[] = [
  'hypothesis',
  'criteria_rules',
  'micro_summary',
  'connection',
  'ifm_review',
  'research',
  'completeness',
  'next_action',
  'conversation',
  'doctor_brief',
  'chronicle',
]

// ===========================================================================
// Database operations (require Supabase)
// ===========================================================================

/**
 * Fetch a single KB document by its document_id.
 */
export async function getKBDocument(documentId: string): Promise<KBDocument | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('clinical_knowledge_base')
    .select('*')
    .eq('document_id', documentId)
    .single()

  if (error || !data) return null
  return data as KBDocument
}

/**
 * Fetch all KB documents of a given type, ordered by generated_at DESC.
 */
export async function getKBDocumentsByType(type: KBDocumentType): Promise<KBDocument[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('clinical_knowledge_base')
    .select('*')
    .eq('document_type', type)
    .order('generated_at', { ascending: false })

  if (error || !data) return []
  return data as KBDocument[]
}

/**
 * Fetch all active (non-stale) KB documents, optionally filtered by type.
 * Ordered by document_type.
 */
export async function getActiveKBDocuments(type?: KBDocumentType): Promise<KBDocument[]> {
  const supabase = getSupabase()
  let query = supabase
    .from('clinical_knowledge_base')
    .select('*')
    .eq('is_stale', false)

  if (type) {
    query = query.eq('document_type', type)
  }

  const { data, error } = await query.order('document_type')

  if (error || !data) return []
  return data as KBDocument[]
}

/**
 * Insert or update a KB document.
 *
 * If the document_id already exists: update content, title, metadata,
 * increment version, set generated_at to now, and mark as not stale.
 *
 * If new: insert with version 1.
 */
export async function upsertKBDocument(doc: Omit<KBDocument, 'id'>): Promise<void> {
  const supabase = getSupabase()

  // Check if document already exists
  const { data: existing } = await supabase
    .from('clinical_knowledge_base')
    .select('id, version')
    .eq('document_id', doc.document_id)
    .single()

  if (existing) {
    // Update existing document
    await supabase
      .from('clinical_knowledge_base')
      .update({
        content: doc.content,
        title: doc.title,
        metadata: doc.metadata,
        version: existing.version + 1,
        generated_at: new Date().toISOString(),
        is_stale: false,
        token_count: doc.token_count,
        covers_date_start: doc.covers_date_start,
        covers_date_end: doc.covers_date_end,
        generated_by: doc.generated_by,
        document_type: doc.document_type,
      })
      .eq('document_id', doc.document_id)
  } else {
    // Insert new document
    await supabase
      .from('clinical_knowledge_base')
      .insert({
        ...doc,
        version: 1,
        generated_at: new Date().toISOString(),
        is_stale: false,
      })
  }
}

/**
 * Mark a single document as stale by document_id.
 */
export async function markStale(documentId: string): Promise<void> {
  const supabase = getSupabase()
  await supabase
    .from('clinical_knowledge_base')
    .update({ is_stale: true })
    .eq('document_id', documentId)
}

/**
 * Mark all documents of a given type as stale.
 */
export async function markTypeStale(type: KBDocumentType): Promise<void> {
  const supabase = getSupabase()
  await supabase
    .from('clinical_knowledge_base')
    .update({ is_stale: true })
    .eq('document_type', type)
}

/**
 * Fetch all stale KB documents.
 */
export async function getStaleDocuments(): Promise<KBDocument[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('clinical_knowledge_base')
    .select('*')
    .eq('is_stale', true)

  if (error || !data) return []
  return data as KBDocument[]
}

/**
 * Load relevant KB context for a Claude API call.
 *
 * Gets all active documents, sorts by clinical priority, and accumulates
 * until the token budget is reached.
 *
 * Returns the formatted text, total token count, and list of document_ids
 * that were included.
 */
export async function loadRelevantKBContext(
  _query: string,
  maxTokens: number = 15000,
): Promise<{ text: string; tokenCount: number; documentsLoaded: string[] }> {
  const allActive = await getActiveKBDocuments()

  // Sort by priority order
  const priorityIndex = (type: KBDocumentType): number => {
    const idx = KB_PRIORITY_ORDER.indexOf(type)
    return idx === -1 ? KB_PRIORITY_ORDER.length : idx
  }

  const sorted = [...allActive].sort(
    (a, b) => priorityIndex(a.document_type) - priorityIndex(b.document_type),
  )

  const parts: string[] = []
  const documentsLoaded: string[] = []
  let tokenCount = 0

  for (const doc of sorted) {
    const formatted = formatKBDocumentForContext(doc)
    const docTokens = estimateTokens(formatted)

    if (tokenCount + docTokens > maxTokens) break

    parts.push(formatted)
    documentsLoaded.push(doc.document_id)
    tokenCount += docTokens
  }

  return {
    text: parts.join('\n\n'),
    tokenCount,
    documentsLoaded,
  }
}
