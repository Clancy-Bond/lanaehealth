/**
 * Backfill embeddings for all health_embeddings rows that have NULL embedding.
 *
 * Usage:
 *   node --env-file=.env.local src/lib/migrations/backfill-embeddings.mjs
 *
 * Requires:
 *   - OPENAI_API_KEY
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

// ── Config ───────────────────────────────────────────────────────

const BATCH_SIZE = 20
const DELAY_MS = 200 // Rate-limit pause between batches

const openaiKey = process.env.OPENAI_API_KEY
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!openaiKey) {
  console.error('Missing OPENAI_API_KEY')
  process.exit(1)
}
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const openai = new OpenAI({ apiKey: openaiKey })
const supabase = createClient(supabaseUrl, supabaseKey)

// ── Helpers ──────────────────────────────────────────────────────

async function generateEmbedding(text) {
  const truncated = text.slice(0, 8000)
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: truncated,
    dimensions: 1536,
  })
  return response.data[0].embedding
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  // Fetch all rows missing embeddings
  const { data: rows, error } = await supabase
    .from('health_embeddings')
    .select('id, narrative')
    .is('embedding', null)
    .order('content_date', { ascending: true })

  if (error) {
    console.error('Failed to query health_embeddings:', error.message)
    process.exit(1)
  }

  const total = rows.length
  console.log(`Found ${total} narratives without embeddings`)

  if (total === 0) {
    console.log('Nothing to backfill.')
    return
  }

  let processed = 0
  let failed = 0

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)

    for (const row of batch) {
      try {
        const embedding = await generateEmbedding(row.narrative)

        const { error: updateError } = await supabase
          .from('health_embeddings')
          .update({ embedding: JSON.stringify(embedding) })
          .eq('id', row.id)

        if (updateError) {
          console.error(`  Failed to update row ${row.id}: ${updateError.message}`)
          failed++
        } else {
          processed++
        }
      } catch (err) {
        console.error(`  Embedding failed for row ${row.id}:`, err.message)
        failed++
      }
    }

    console.log(`Processed ${Math.min(i + BATCH_SIZE, total)}/${total} narratives`)

    // Rate-limit delay between batches
    if (i + BATCH_SIZE < total) {
      await sleep(DELAY_MS)
    }
  }

  console.log(`\nBackfill complete: ${processed} succeeded, ${failed} failed out of ${total}`)
}

main().catch((err) => {
  console.error('Backfill script crashed:', err)
  process.exit(1)
})
