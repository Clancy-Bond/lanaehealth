/**
 * Smoke test for scripts/migrate.mjs
 *
 * Uses Node's native `node:test` runner so it does not need the vitest
 * config to pick it up. Run via:
 *
 *   node --test scripts/__tests__/migrate.test.mjs
 *
 * No live DB is touched. pg.Client is replaced with a scripted fake that
 * records every query and returns canned results.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

import {
  listMigrationFiles,
  ensureMigrationsTable,
  fetchAppliedMigrations,
  applyMigration,
  runMigrations,
} from '../migrate.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE_DIR = resolve(__dirname, 'fixtures', 'migrations')

/**
 * Build a fake pg.Client. `responder` is called with { text, values }
 * for every query and returns the rows result.
 */
function makeFakeClient(responder) {
  const log = []
  return {
    log,
    async query(text, values) {
      const entry = typeof text === 'string' ? { text, values } : text
      log.push(entry)
      const res = responder(entry)
      return res ?? { rows: [] }
    },
  }
}

describe('listMigrationFiles', () => {
  it('reads the directory, filters .sql, and sorts alphanumerically', () => {
    const files = listMigrationFiles(FIXTURE_DIR)
    assert.deepEqual(files, [
      '002_early.sql',
      '010_first.sql',
      '011_second.sql',
    ])
    // not-a-migration.txt is filtered out
    assert.ok(!files.includes('not-a-migration.txt'))
    // 002 sorts before 010 (numeric sort, not raw lexical)
    assert.ok(files.indexOf('002_early.sql') < files.indexOf('010_first.sql'))
  })
})

describe('ensureMigrationsTable', () => {
  it('issues a CREATE TABLE IF NOT EXISTS schema_migrations statement', async () => {
    const client = makeFakeClient(() => ({ rows: [] }))
    await ensureMigrationsTable(client)
    assert.equal(client.log.length, 1)
    const sql = client.log[0].text
    assert.match(sql, /CREATE TABLE IF NOT EXISTS schema_migrations/i)
    assert.match(sql, /name text PRIMARY KEY/i)
    assert.match(sql, /applied_at timestamptz/i)
  })
})

describe('fetchAppliedMigrations', () => {
  it('returns a Set of names from the SELECT result', async () => {
    const client = makeFakeClient(({ text }) => {
      if (/SELECT name FROM schema_migrations/i.test(text)) {
        return {
          rows: [{ name: '001-context-engine.sql' }, { name: '009_bearable_killer.sql' }],
        }
      }
      return { rows: [] }
    })
    const applied = await fetchAppliedMigrations(client)
    assert.ok(applied instanceof Set)
    assert.ok(applied.has('001-context-engine.sql'))
    assert.ok(applied.has('009_bearable_killer.sql'))
    assert.ok(!applied.has('011_endometriosis_mode.sql'))
  })
})

describe('applyMigration', () => {
  it('wraps the SQL in a transaction and inserts into schema_migrations', async () => {
    const client = makeFakeClient(() => ({ rows: [] }))
    const outcome = await applyMigration(client, '010_first.sql', 'SELECT 1')
    assert.equal(outcome, 'applied')

    const texts = client.log.map((e) => e.text)
    assert.equal(texts[0], 'BEGIN')
    assert.equal(texts[1], 'SELECT 1')
    assert.match(
      texts[2],
      /INSERT INTO schema_migrations \(name\) VALUES \(\$1\) ON CONFLICT/i
    )
    assert.deepEqual(client.log[2].values, ['010_first.sql'])
    assert.equal(texts[3], 'COMMIT')
  })

  it('rolls back and reports already-present on 42P07 (duplicate_table)', async () => {
    let calls = 0
    const client = makeFakeClient(({ text }) => {
      calls += 1
      if (text === 'SELECT 1 + existing') {
        const err = new Error('relation already exists')
        err.code = '42P07'
        throw err
      }
      return { rows: [] }
    })
    const outcome = await applyMigration(
      client,
      '011_second.sql',
      'SELECT 1 + existing'
    )
    assert.equal(outcome, 'already-present')
    const texts = client.log.map((e) => e.text)
    assert.ok(texts.includes('BEGIN'))
    assert.ok(texts.includes('ROLLBACK'))
    // It records the name post-rollback so subsequent runs skip cleanly
    const recorded = client.log.find(
      (e) =>
        /INSERT INTO schema_migrations/i.test(e.text) &&
        Array.isArray(e.values) &&
        e.values[0] === '011_second.sql'
    )
    assert.ok(recorded, 'should record the migration after soft-success')
    assert.ok(calls > 0)
  })

  it('rethrows non-already-exists errors', async () => {
    const client = makeFakeClient(({ text }) => {
      if (text === 'BAD SQL') {
        const err = new Error('syntax error')
        err.code = '42601'
        throw err
      }
      return { rows: [] }
    })
    await assert.rejects(
      () => applyMigration(client, 'broken.sql', 'BAD SQL'),
      /syntax error/
    )
  })
})

describe('runMigrations (integration over fixtures)', () => {
  it('creates schema_migrations, skips already-applied rows, inserts after applying', async () => {
    // Simulate a DB where 002_early.sql is already applied.
    const client = makeFakeClient(({ text }) => {
      if (/SELECT name FROM schema_migrations/i.test(text)) {
        return { rows: [{ name: '002_early.sql' }] }
      }
      return { rows: [] }
    })

    const logs = []
    const summary = await runMigrations({
      client,
      migrationsDir: FIXTURE_DIR,
      log: (line) => logs.push(line),
    })

    assert.deepEqual(summary.skipped, ['002_early.sql'])
    assert.deepEqual(summary.applied, ['010_first.sql', '011_second.sql'])
    assert.deepEqual(summary.alreadyPresent, [])

    // ensureMigrationsTable ran first
    assert.match(client.log[0].text, /CREATE TABLE IF NOT EXISTS schema_migrations/i)

    // Second call reads applied set
    assert.match(client.log[1].text, /SELECT name FROM schema_migrations/i)

    // Then per-applied file: BEGIN, sql, INSERT, COMMIT. Count the INSERTs.
    const inserts = client.log.filter(
      (e) =>
        /INSERT INTO schema_migrations/i.test(e.text) &&
        Array.isArray(e.values)
    )
    assert.equal(inserts.length, 2)
    assert.deepEqual(
      inserts.map((e) => e.values[0]).sort(),
      ['010_first.sql', '011_second.sql']
    )

    // Stdout lines show the summary format
    assert.ok(logs.some((l) => l.startsWith('[SKIP]') && l.includes('002_early.sql')))
    assert.ok(logs.some((l) => l.startsWith('[APPLIED]') && l.includes('010_first.sql')))
    assert.ok(logs.some((l) => l.startsWith('[APPLIED]') && l.includes('011_second.sql')))
  })
})
