/**
 * Migration Runner for 002: Vector Store (pgvector)
 *
 * Creates health_embeddings table, indexes, and search functions.
 * Uses `pg` for DDL via direct PostgreSQL connection.
 *
 * Usage: node src/lib/migrations/run-002-vector-store.mjs
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Load env from .env.local ---
const envPath = resolve(__dirname, '../../../.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const DB_PASSWORD = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !DB_PASSWORD) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

// Extract project ref from URL
const projectRef = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');
const PG_CONNECTION = `postgresql://postgres.${projectRef}:${DB_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`;

// ============================================================
// Run migration
// ============================================================
async function main() {
  console.log('========================================');
  console.log('Migration 002: Vector Store (pgvector)');
  console.log('========================================');
  console.log(`Project Ref: ${projectRef}\n`);

  const sqlPath = resolve(__dirname, '002-vector-store.sql');
  const sql = readFileSync(sqlPath, 'utf-8');

  const client = new pg.Client({ connectionString: PG_CONNECTION });

  try {
    console.log('Connecting to Supabase PostgreSQL...');
    await client.connect();
    console.log('Connected!\n');

    // Execute the SQL migration
    console.log('Executing vector store migration...');
    await client.query(sql);
    console.log('Migration SQL executed successfully!\n');

    // Verify: check that the extension is enabled
    const extRes = await client.query(`
      SELECT extname FROM pg_extension WHERE extname = 'vector';
    `);
    if (extRes.rows.length > 0) {
      console.log('pgvector extension: ENABLED');
    } else {
      console.error('pgvector extension: NOT FOUND (may require manual enable in Supabase dashboard)');
    }

    // Verify: check table exists
    const tableRes = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'health_embeddings';
    `);
    console.log(`health_embeddings table: ${tableRes.rows.length > 0 ? 'CREATED' : 'NOT FOUND'}`);

    // Verify: check indexes
    const idxRes = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'health_embeddings'
      ORDER BY indexname;
    `);
    console.log(`\nIndexes created (${idxRes.rows.length}):`);
    for (const row of idxRes.rows) {
      console.log(`  - ${row.indexname}`);
    }

    // Verify: check functions
    const fnRes = await client.query(`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND routine_name IN ('search_health_data', 'search_health_text')
      ORDER BY routine_name;
    `);
    console.log(`\nFunctions created (${fnRes.rows.length}):`);
    for (const row of fnRes.rows) {
      console.log(`  - ${row.routine_name}`);
    }

    // Verify: check columns
    const colRes = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'health_embeddings'
      ORDER BY ordinal_position;
    `);
    console.log(`\nColumns (${colRes.rows.length}):`);
    for (const row of colRes.rows) {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    }

    console.log('\n========================================');
    console.log('Migration 002 COMPLETE');
    console.log('========================================');

  } catch (err) {
    console.error('\nMigration error:', err.message);
    if (err.message.includes('extension "vector" is not available')) {
      console.error('\nThe pgvector extension must be enabled in Supabase Dashboard:');
      console.error('  1. Go to https://supabase.com/dashboard');
      console.error('  2. Open your project -> Database -> Extensions');
      console.error('  3. Search for "vector" and enable it');
      console.error('  4. Re-run this migration');
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
