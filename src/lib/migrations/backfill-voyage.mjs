/**
 * Backfill embeddings for all health_embeddings rows that have NULL embedding.
 *
 * Uses Voyage AI's voyage-4 model (1024-dim output). Voyage is
 * Anthropic's embeddings company (acquired 2024), so this is the
 * Claude-native choice for the project.
 *
 * Usage:
 *   node --env-file=.env.local src/lib/migrations/backfill-voyage.mjs
 *
 * Requires:
 *   - VOYAGE_API_KEY
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * Schema prerequisite: health_embeddings.embedding must be vector(1024).
 * If still vector(1536), run the migration in docs/qa/2026-04-17-voyage-pgvector-migration.sql.
 */

import { createClient } from '@supabase/supabase-js'

// ── Config ───────────────────────────────────────────────────────

const MODEL = 'voyage-4'
const OUTPUT_DIM = 1024
// Voyage free tier (no payment method): 3 RPM, 10K TPM.
// With batch_size 64 and ~67 tokens/narrative observed, one batch = ~4300 tokens,
// well under TPM. We space batches 25s apart to stay under 3 RPM.
// With a payment method added, set SPEED_MODE=fast to use 64/150ms.
const SPEED_MODE = process.env.VOYAGE_SPEED_MODE === 'fast' ? 'fast' : 'free'
// Free tier: 3 RPM, 10K TPM. Larger batches = fewer requests. Voyage allows
// up to 128 inputs per call. Our narratives average ~67 tokens, so 128 per
// batch is ~8.5K tokens, under the 10K/min cap. 40s between requests keeps
// well under 3 RPM with headroom for any concurrent query-time embeddings.
const SPEED_MODE_IS_FAST = SPEED_MODE === 'fast'
const BATCH_SIZE = SPEED_MODE_IS_FAST ? 64 : 128
const DELAY_MS = SPEED_MODE_IS_FAST ? 150 : 40_000
const INITIAL_WAIT_MS = SPEED_MODE_IS_FAST ? 0 : 30_000 // cool down before first request
const MAX_INPUT_CHARS = 32000
const MAX_RETRIES = 3
const PAGE_SIZE = 1000

const voyageKey = process.env.VOYAGE_API_KEY
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!voyageKey) {
  console.error('Missing VOYAGE_API_KEY')
  process.exit(1)
}
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Generate embeddings for a batch of input strings via Voyage's REST API.
 * Retries with exponential backoff on 429 (rate limit).
 * Returns an array of number[] vectors in the same order as inputs.
 */
async function embedBatch(inputs, retry = 0) {
  const truncated = inputs.map((t) => (t ?? '').slice(0, MAX_INPUT_CHARS))
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${voyageKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: truncated,
      model: MODEL,
      input_type: 'document',
      output_dimension: OUTPUT_DIM,
    }),
  })
  if (res.status === 429 && retry < MAX_RETRIES) {
    const backoff = Math.min(30_000, 5_000 * Math.pow(2, retry))
    console.log(`  Rate limited, waiting ${backoff}ms before retry ${retry + 1}/${MAX_RETRIES}`)
    await sleep(backoff)
    return embedBatch(inputs, retry + 1)
  }
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Voyage ${res.status}: ${body.slice(0, 300)}`)
  }
  const payload = await res.json()
  const vectors = payload.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding)
  if (vectors.length !== inputs.length) {
    throw new Error(`Voyage returned ${vectors.length} vectors for ${inputs.length} inputs`)
  }
  for (const v of vectors) {
    if (v.length !== OUTPUT_DIM) {
      throw new Error(`Expected ${OUTPUT_DIM}-dim vectors, got ${v.length}`)
    }
  }
  return { vectors, usage: payload.usage }
}

/**
 * Paginate through all NULL-embedding rows. Supabase client caps .select()
 * at 1000 rows by default; this walks by content_date to get everything.
 */
async function fetchAllNullRows() {
  const all = []
  let cursor = '0001-01-01'
  while (true) {
    const { data, error } = await supabase
      .from('health_embeddings')
      .select('id, narrative, content_date')
      .is('embedding', null)
      .gt('content_date', cursor)
      .order('content_date', { ascending: true })
      .limit(PAGE_SIZE)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE_SIZE) break
    cursor = data[data.length - 1].content_date
  }
  return all
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  let rows
  try {
    rows = await fetchAllNullRows()
  } catch (err) {
    console.error('Failed to query health_embeddings:', err.message)
    process.exit(1)
  }

  const total = rows.length
  console.log(`Found ${total} narratives without embeddings (model=${MODEL}, dim=${OUTPUT_DIM}, mode=${SPEED_MODE})`)

  if (total === 0) {
    console.log('Nothing to backfill.')
    return
  }

  let processed = 0
  let failed = 0
  let tokensUsed = 0
  const t0 = Date.now()

  // Initial cooldown so a previous script run's rate window has time to clear
  if (INITIAL_WAIT_MS > 0) {
    console.log(`Initial cooldown: ${INITIAL_WAIT_MS / 1000}s before first request...`)
    await sleep(INITIAL_WAIT_MS)
  }

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const inputs = batch.map((r) => r.narrative)

    try {
      const { vectors, usage } = await embedBatch(inputs)
      tokensUsed += usage?.total_tokens ?? 0

      // Update each row. Supabase client does not batch updates by differing
      // values, so we fire one update per row. It's small and parallel-safe.
      await Promise.all(
        batch.map(async (row, idx) => {
          const { error: updateError } = await supabase
            .from('health_embeddings')
            .update({ embedding: JSON.stringify(vectors[idx]) })
            .eq('id', row.id)
          if (updateError) {
            console.error(`  Update failed for ${row.id}: ${updateError.message}`)
            failed += 1
          } else {
            processed += 1
          }
        }),
      )

      const done = Math.min(i + BATCH_SIZE, total)
      const secs = ((Date.now() - t0) / 1000).toFixed(1)
      console.log(`Processed ${done}/${total}  (tokens so far: ${tokensUsed}, ${secs}s elapsed)`)
    } catch (err) {
      console.error(`  Batch starting at ${i} failed:`, err.message)
      failed += batch.length
    }

    if (i + BATCH_SIZE < total) {
      await sleep(DELAY_MS)
    }
  }

  const secs = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`\nBackfill complete in ${secs}s: ${processed} succeeded, ${failed} failed of ${total}`)
  console.log(`Total tokens used: ${tokensUsed}`)
  console.log(`Approx cost: $${((tokensUsed / 1_000_000) * 0.06).toFixed(4)} (voyage-4 @ $0.06/M, 200M free tier)`)
}

main().catch((err) => {
  console.error('Backfill script crashed:', err)
  process.exit(1)
})
