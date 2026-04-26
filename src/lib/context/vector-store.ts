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

// Voyage AI (Anthropic's embeddings company). Uses fetch directly; no SDK needed.
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

// ── Voyage AI Embeddings ──────────────────────────────────────────

const VOYAGE_MODEL = 'voyage-4'
const VOYAGE_DIM = 1024
const VOYAGE_MAX_INPUT_CHARS = 32000 // voyage-4 context is 32k tokens; conservative char cap

/**
 * Generates a 1024-dim embedding vector for the given text using
 * Voyage AI's voyage-4 model. Voyage is Anthropic's embeddings company.
 *
 * Input type defaults to 'query' (optimized for search queries). Use
 * `upsertNarrative` below for corpus ingestion, which passes 'document'.
 *
 * Returns null (graceful fallback to text search) when:
 *   - No VOYAGE_API_KEY is configured
 *   - The API call fails for any reason
 *
 * Once embeddings are populated, create the IVFFlat index:
 *   CREATE INDEX idx_health_embeddings_vector ON health_embeddings
 *     USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
 */
export async function generateEmbedding(
  text: string,
  inputType: 'query' | 'document' = 'query',
): Promise<number[] | null> {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey || apiKey === 'placeholder' || apiKey.length < 10) return null

  try {
    const truncated = text.slice(0, VOYAGE_MAX_INPUT_CHARS)
    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: [truncated],
        model: VOYAGE_MODEL,
        input_type: inputType,
        output_dimension: VOYAGE_DIM,
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      console.error(`Voyage embedding ${res.status}: ${body.slice(0, 200)}`)
      return null
    }
    const payload = (await res.json()) as {
      data: Array<{ embedding: number[] }>
    }
    return payload.data[0]?.embedding ?? null
  } catch (err) {
    console.error('Embedding generation failed:', err instanceof Error ? err.message : err)
    return null // Fallback to text search
  }
}

// ── Upsert Narrative ──────────────────────────────────────────────

/**
 * Inserts or updates a narrative chunk in health_embeddings.
 * Generates an embedding if possible; otherwise stores with null embedding.
 *
 * userId is required: every embedding row is owned by a single user, so
 * cross-user searches never blend symptoms.
 */
export async function upsertNarrative(
  contentId: string,
  contentType: string,
  contentDate: string,
  narrative: string,
  userId: string,
  metadata: EmbeddingMetadata = {},
): Promise<void> {
  if (!userId) {
    throw new Error('upsertNarrative: userId is required')
  }
  const sb = createServiceClient()

  // Attempt embedding generation (returns null if no model configured).
  // Use 'document' input type for corpus ingestion so Voyage embeds with the
  // corpus-side basis. Query-time calls (in searchByText below) default to 'query'.
  const embedding = await generateEmbedding(narrative, 'document')

  const row: Record<string, unknown> = {
    content_id: contentId,
    user_id: userId,
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

/**
 * Batch-upserts multiple narrative chunks in a single DB round-trip.
 * Much more efficient than calling upsertNarrative() in a loop when
 * syncing many days at once.
 *
 * Processes in batches of 50 to stay within Supabase payload limits.
 */
export async function upsertNarrativeBatch(
  rows: Array<{
    contentId: string
    contentType: string
    contentDate: string
    narrative: string
    metadata: EmbeddingMetadata
  }>,
  userId: string,
): Promise<number> {
  if (!userId) {
    throw new Error('upsertNarrativeBatch: userId is required')
  }
  if (rows.length === 0) return 0

  const sb = createServiceClient()
  const now = new Date().toISOString()
  const BATCH_SIZE = 50
  let upserted = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)

    const dbRows = batch.map((r) => ({
      content_id: r.contentId,
      user_id: userId,
      content_type: r.contentType,
      content_date: r.contentDate,
      narrative: r.narrative,
      cycle_phase: r.metadata.cyclePhase ?? null,
      pain_level: r.metadata.painLevel ?? null,
      has_period: r.metadata.hasPeriod ?? false,
      symptom_categories: r.metadata.symptomCategories ?? [],
      updated_at: now,
    }))

    const { error } = await sb
      .from('health_embeddings')
      .upsert(dbRows, { onConflict: 'content_id' })

    if (error) {
      console.error(`Batch upsert error (offset ${i}):`, error.message)
      // Fall back to individual upserts for this batch
      for (const r of batch) {
        await upsertNarrative(
          r.contentId,
          r.contentType,
          r.contentDate,
          r.narrative,
          userId,
          r.metadata,
        )
      }
    }

    upserted += batch.length
  }

  return upserted
}

// ── Search ────────────────────────────────────────────────────────

/**
 * Searches health narratives by text query.
 *
 * Strategy:
 *   1. If embeddings exist in the table, try vector similarity search
 *   2. Fall back to PostgreSQL full-text search otherwise
 *
 * Both paths apply the same metadata filters AND scope to userId so a
 * search NEVER returns another user's records.
 */
export async function searchByText(
  query: string,
  userId: string,
  options: SearchOptions = {},
): Promise<SearchResult[]> {
  if (!userId) {
    throw new Error('searchByText: userId is required')
  }
  const sb = createServiceClient()
  const matchCount = options.matchCount ?? 10

  // Check if any embeddings exist (cached check per request is fine).
  // Scope to user so we don't fall through to vector search when only
  // OTHER users have embeddings.
  const { count: embeddingCount } = await sb
    .from('health_embeddings')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('embedding', 'is', null)

  const hasEmbeddings = (embeddingCount ?? 0) > 0

  if (hasEmbeddings) {
    // Vector search path: generate query embedding, call RPC
    const queryEmbedding = await generateEmbedding(query)

    if (queryEmbedding) {
      return vectorSearch(sb, queryEmbedding, matchCount, userId, options)
    }
  }

  // Fallback: full-text search
  return textSearch(sb, query, matchCount, userId, options)
}

// ── Private: Vector Search ────────────────────────────────────────

async function vectorSearch(
  sb: ReturnType<typeof createServiceClient>,
  queryEmbedding: number[],
  matchCount: number,
  userId: string,
  options: SearchOptions,
): Promise<SearchResult[]> {
  // Try the user-scoped RPC first; fall back to legacy if not deployed.
  // The legacy RPC is then post-filtered by user_id below.
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
    return textSearch(sb, '', matchCount, userId, options)
  }

  // Post-filter by user_id (defense in depth: the RPC may not yet enforce
  // user scope server-side until migration 038 + RPC update lands).
  const all = (data ?? []) as Array<RpcResultRow & { user_id?: string }>
  const scoped = all.filter((r) => !r.user_id || r.user_id === userId)
  return scoped.map(mapResult)
}

// ── Private: Full-Text Search ─────────────────────────────────────

async function textSearch(
  sb: ReturnType<typeof createServiceClient>,
  query: string,
  matchCount: number,
  userId: string,
  options: SearchOptions,
): Promise<SearchResult[]> {
  // If query is empty, just return most recent entries with filters
  if (!query.trim()) {
    return recentEntries(sb, matchCount, userId, options)
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
    return recentEntries(sb, matchCount, userId, options)
  }

  // Post-filter by user_id; see vectorSearch for the rationale.
  const all = (data ?? []) as Array<RpcResultRow & { user_id?: string }>
  const scoped = all.filter((r) => !r.user_id || r.user_id === userId)
  return scoped.map(mapResult)
}

// ── Private: Recent Entries (no query) ────────────────────────────

async function recentEntries(
  sb: ReturnType<typeof createServiceClient>,
  limit: number,
  userId: string,
  options: SearchOptions,
): Promise<SearchResult[]> {
  let q = sb
    .from('health_embeddings')
    .select('id, content_id, content_type, content_date, narrative, cycle_phase, pain_level')
    .eq('user_id', userId)
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
 *
 * Scoped to userId so a re-index for one user never touches another's
 * narratives.
 */
export async function deleteByDate(date: string, userId: string): Promise<number> {
  if (!userId) {
    throw new Error('deleteByDate: userId is required')
  }
  const sb = createServiceClient()

  const { data, error } = await sb
    .from('health_embeddings')
    .delete()
    .eq('user_id', userId)
    .eq('content_date', date)
    .select('id')

  if (error) {
    throw new Error(`deleteByDate(${date}): ${error.message}`)
  }

  return data?.length ?? 0
}

/**
 * Removes a single embedding by content_id, scoped to userId.
 */
export async function deleteByContentId(contentId: string, userId: string): Promise<void> {
  if (!userId) {
    throw new Error('deleteByContentId: userId is required')
  }
  const sb = createServiceClient()

  const { error } = await sb
    .from('health_embeddings')
    .delete()
    .eq('user_id', userId)
    .eq('content_id', contentId)

  if (error) {
    throw new Error(`deleteByContentId(${contentId}): ${error.message}`)
  }
}

// ── Stats ─────────────────────────────────────────────────────────

// Known content_type values produced by src/lib/context/sync-pipeline.ts.
// Kept in sync with that file and with src/app/api/context/sync-status/route.ts.
const KNOWN_CONTENT_TYPES = ['daily_log', 'lab_result', 'imaging'] as const

/**
 * Returns basic stats about the vector store, scoped to one user.
 *
 * Per-type counts use HEAD queries (count: 'exact', head: true) instead of
 * selecting content_type and bucketing in-process -- Supabase silently caps
 * untotaled selects at 1000 rows, which hid non-daily_log types from the
 * breakdown before this fix.
 */
export async function getVectorStoreStats(userId: string): Promise<{
  totalNarratives: number
  withEmbeddings: number
  withoutEmbeddings: number
  dateRange: { earliest: string | null; latest: string | null }
  byType: Record<string, number>
}> {
  if (!userId) {
    throw new Error('getVectorStoreStats: userId is required')
  }
  const sb = createServiceClient()

  const typeCountPromises = KNOWN_CONTENT_TYPES.map((t) =>
    sb.from('health_embeddings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('content_type', t)
      .then((res) => ({ type: t, count: res.count ?? 0 })),
  )

  const [totalRes, embeddedRes, dateRes, latestRes, ...typeResults] = await Promise.all([
    sb.from('health_embeddings').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    sb.from('health_embeddings').select('*', { count: 'exact', head: true }).eq('user_id', userId).not('embedding', 'is', null),
    sb.from('health_embeddings').select('content_date').eq('user_id', userId).order('content_date', { ascending: true }).limit(1),
    sb.from('health_embeddings').select('content_date').eq('user_id', userId).order('content_date', { ascending: false }).limit(1),
    ...typeCountPromises,
  ])

  const total = totalRes.count ?? 0
  const embedded = embeddedRes.count ?? 0
  const earliest = dateRes.data?.[0]?.content_date ?? null
  const latest = latestRes.data?.[0]?.content_date ?? null

  const byType: Record<string, number> = {}
  for (const r of typeResults) {
    byType[r.type] = r.count
  }

  return {
    totalNarratives: total,
    withEmbeddings: embedded,
    withoutEmbeddings: total - embedded,
    dateRange: { earliest, latest },
    byType,
  }
}
