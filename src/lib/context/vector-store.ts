/**
 * Layer 3: Vector Store
 *
 * Handles embedding generation, narrative storage, and semantic search
 * using Supabase's built-in pgvector extension.
 *
 * Design:
 *   - Embeddings are optional; narratives are always stored as plain text
 *   - If embeddings are available: vector cosine similarity search via search_health_data()
 *   - If not: PostgreSQL full-text search fallback via search_health_text()
 *   - Both paths support identical metadata filters (date range, type, phase, pain)
 */

import { createServiceClient } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────

export interface EmbeddingMetadata {
  cyclePhase?: string | null
  painLevel?: number | null
  hasPeriod?: boolean
  symptomCategories?: string[]
}

export interface SearchOptions {
  matchCount?: number
  dateStart?: string | null  // ISO date YYYY-MM-DD
  dateEnd?: string | null
  contentType?: string | null
  cyclePhase?: string | null
  minPain?: number | null
}

export interface SearchResult {
  id: string
  contentId: string
  contentType: string
  contentDate: string
  narrative: string
  cyclePhase: string | null
  painLevel: number | null
  score: number  // similarity (vector) or relevance (text)
}

// ── Embedding Generation ──────────────────────────────────────────

/**
 * Generates a 1536-dim embedding vector for the given text.
 *
 * Currently a placeholder that returns null. To enable:
 *   Option A: Use OpenAI text-embedding-3-small (1536 dims)
 *   Option B: Use Voyage AI embeddings via Anthropic partner API
 *   Option C: Use Supabase Edge Function with any embedding model
 *
 * When implemented, swap this function body and all existing narratives
 * will gain embeddings on next sync. Then create the IVFFlat index:
 *   CREATE INDEX idx_health_embeddings_vector ON health_embeddings
 *     USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
 */
export async function generateEmbedding(
  _text: string,
): Promise<number[] | null> {
  // TODO: Plug in embedding model when API key is available.
  // Returning null means the row stores narrative text only,
  // and search falls back to PostgreSQL full-text search.
  return null
}

// ── Upsert Narrative ──────────────────────────────────────────────

/**
 * Inserts or updates a narrative chunk in health_embeddings.
 * Generates an embedding if possible; otherwise stores with null embedding.
 */
export async function upsertNarrative(
  contentId: string,
  contentType: string,
  contentDate: string,
  narrative: string,
  metadata: EmbeddingMetadata = {},
): Promise<void> {
  const sb = createServiceClient()

  // Attempt embedding generation (returns null if no model configured)
  const embedding = await generateEmbedding(narrative)

  const row: Record<string, unknown> = {
    content_id: contentId,
    content_type: contentType,
    content_date: contentDate,
    narrative,
    cycle_phase: metadata.cyclePhase ?? null,
    pain_level: metadata.painLevel ?? null,
    has_period: metadata.hasPeriod ?? false,
    symptom_categories: metadata.symptomCategories ?? [],
    updated_at: new Date().toISOString(),
  }

  // Only include embedding if we actually generated one
  if (embedding) {
    // Supabase expects the vector as a JSON string: "[0.1, 0.2, ...]"
    row.embedding = JSON.stringify(embedding)
  }

  const { error } = await sb
    .from('health_embeddings')
    .upsert(row, { onConflict: 'content_id' })

  if (error) {
    throw new Error(`upsertNarrative(${contentId}): ${error.message}`)
  }
}

// ── Search ────────────────────────────────────────────────────────

/**
 * Searches health narratives by text query.
 *
 * Strategy:
 *   1. If embeddings exist in the table, try vector similarity search
 *   2. Fall back to PostgreSQL full-text search otherwise
 *
 * Both paths apply the same metadata filters.
 */
export async function searchByText(
  query: string,
  options: SearchOptions = {},
): Promise<SearchResult[]> {
  const sb = createServiceClient()
  const matchCount = options.matchCount ?? 10

  // Check if any embeddings exist (cached check per request is fine)
  const { count: embeddingCount } = await sb
    .from('health_embeddings')
    .select('id', { count: 'exact', head: true })
    .not('embedding', 'is', null)

  const hasEmbeddings = (embeddingCount ?? 0) > 0

  if (hasEmbeddings) {
    // Vector search path: generate query embedding, call RPC
    const queryEmbedding = await generateEmbedding(query)

    if (queryEmbedding) {
      return vectorSearch(sb, queryEmbedding, matchCount, options)
    }
  }

  // Fallback: full-text search
  return textSearch(sb, query, matchCount, options)
}

// ── Private: Vector Search ────────────────────────────────────────

async function vectorSearch(
  sb: ReturnType<typeof createServiceClient>,
  queryEmbedding: number[],
  matchCount: number,
  options: SearchOptions,
): Promise<SearchResult[]> {
  const { data, error } = await sb.rpc('search_health_data', {
    query_embedding: JSON.stringify(queryEmbedding),
    match_count: matchCount,
    filter_date_start: options.dateStart ?? null,
    filter_date_end: options.dateEnd ?? null,
    filter_type: options.contentType ?? null,
    filter_phase: options.cyclePhase ?? null,
    filter_min_pain: options.minPain ?? null,
  })

  if (error) {
    console.error('Vector search failed, falling back to text search:', error.message)
    // Fall back to text search on error
    return textSearch(sb, '', matchCount, options)
  }

  return (data ?? []).map(mapResult)
}

// ── Private: Full-Text Search ─────────────────────────────────────

async function textSearch(
  sb: ReturnType<typeof createServiceClient>,
  query: string,
  matchCount: number,
  options: SearchOptions,
): Promise<SearchResult[]> {
  // If query is empty, just return most recent entries with filters
  if (!query.trim()) {
    return recentEntries(sb, matchCount, options)
  }

  const { data, error } = await sb.rpc('search_health_text', {
    query_text: query,
    match_count: matchCount,
    filter_date_start: options.dateStart ?? null,
    filter_date_end: options.dateEnd ?? null,
    filter_type: options.contentType ?? null,
    filter_phase: options.cyclePhase ?? null,
    filter_min_pain: options.minPain ?? null,
  })

  if (error) {
    console.error('Text search failed:', error.message)
    // Last resort: return most recent entries matching filters
    return recentEntries(sb, matchCount, options)
  }

  return (data ?? []).map(mapResult)
}

// ── Private: Recent Entries (no query) ────────────────────────────

async function recentEntries(
  sb: ReturnType<typeof createServiceClient>,
  limit: number,
  options: SearchOptions,
): Promise<SearchResult[]> {
  let q = sb
    .from('health_embeddings')
    .select('id, content_id, content_type, content_date, narrative, cycle_phase, pain_level')
    .order('content_date', { ascending: false })
    .limit(limit)

  if (options.dateStart) q = q.gte('content_date', options.dateStart)
  if (options.dateEnd) q = q.lte('content_date', options.dateEnd)
  if (options.contentType) q = q.eq('content_type', options.contentType)
  if (options.cyclePhase) q = q.eq('cycle_phase', options.cyclePhase)
  if (options.minPain) q = q.gte('pain_level', options.minPain)

  const { data, error } = await q

  if (error) {
    console.error('recentEntries query failed:', error.message)
    return []
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    contentId: row.content_id,
    contentType: row.content_type,
    contentDate: row.content_date,
    narrative: row.narrative,
    cyclePhase: row.cycle_phase,
    painLevel: row.pain_level,
    score: 0,
  }))
}

// ── Private: Row Mapper ───────────────────────────────────────────

interface RpcResultRow {
  id: string
  content_id: string
  content_type: string
  content_date: string
  narrative: string
  cycle_phase: string | null
  pain_level: number | null
  similarity?: number
  relevance?: number
}

function mapResult(row: RpcResultRow): SearchResult {
  return {
    id: row.id,
    contentId: row.content_id,
    contentType: row.content_type,
    contentDate: row.content_date,
    narrative: row.narrative,
    cyclePhase: row.cycle_phase,
    painLevel: row.pain_level,
    score: row.similarity ?? row.relevance ?? 0,
  }
}

// ── Delete ────────────────────────────────────────────────────────

/**
 * Removes all embeddings for a specific date (for re-indexing).
 */
export async function deleteByDate(date: string): Promise<number> {
  const sb = createServiceClient()

  const { data, error } = await sb
    .from('health_embeddings')
    .delete()
    .eq('content_date', date)
    .select('id')

  if (error) {
    throw new Error(`deleteByDate(${date}): ${error.message}`)
  }

  return data?.length ?? 0
}

/**
 * Removes a single embedding by content_id.
 */
export async function deleteByContentId(contentId: string): Promise<void> {
  const sb = createServiceClient()

  const { error } = await sb
    .from('health_embeddings')
    .delete()
    .eq('content_id', contentId)

  if (error) {
    throw new Error(`deleteByContentId(${contentId}): ${error.message}`)
  }
}

// ── Stats ─────────────────────────────────────────────────────────

/**
 * Returns basic stats about the vector store.
 */
export async function getVectorStoreStats(): Promise<{
  totalNarratives: number
  withEmbeddings: number
  withoutEmbeddings: number
  dateRange: { earliest: string | null; latest: string | null }
  byType: Record<string, number>
}> {
  const sb = createServiceClient()

  const [totalRes, embeddedRes, dateRes, typeRes] = await Promise.all([
    sb.from('health_embeddings').select('id', { count: 'exact', head: true }),
    sb.from('health_embeddings').select('id', { count: 'exact', head: true }).not('embedding', 'is', null),
    sb.from('health_embeddings').select('content_date').order('content_date', { ascending: true }).limit(1),
    sb.from('health_embeddings').select('content_type'),
  ])

  const total = totalRes.count ?? 0
  const embedded = embeddedRes.count ?? 0
  const earliest = dateRes.data?.[0]?.content_date ?? null

  // Get latest date
  const latestRes = await sb.from('health_embeddings').select('content_date').order('content_date', { ascending: false }).limit(1)
  const latest = latestRes.data?.[0]?.content_date ?? null

  // Count by type
  const byType: Record<string, number> = {}
  for (const row of typeRes.data ?? []) {
    const t = row.content_type as string
    byType[t] = (byType[t] ?? 0) + 1
  }

  return {
    totalNarratives: total,
    withEmbeddings: embedded,
    withoutEmbeddings: total - embedded,
    dateRange: { earliest, latest },
    byType,
  }
}
