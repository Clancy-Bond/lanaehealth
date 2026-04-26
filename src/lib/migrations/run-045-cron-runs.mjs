import pg from 'pg'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../../../.env.local')
const env = {}
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const eq = t.indexOf('=')
  if (eq === -1) continue
  env[t.slice(0, eq)] = t.slice(eq + 1)
}
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
const ref = url.replace('https://', '').replace('.supabase.co', '')
const conn = `postgresql://postgres.${ref}:${key}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`
const sql = readFileSync(resolve(__dirname, '045_cron_runs.sql'), 'utf-8')
const client = new pg.Client({ connectionString: conn })
await client.connect()
await client.query(sql)
console.log('Migration 045 complete.')
await client.end()
