/**
 * Regression tests for QA Session 2 W2.4.
 *
 * `DELETE /api/chat/history` used to wipe every row in chat_messages with
 * no confirmation. These tests lock in the new guarded behavior:
 *
 *   - no params       -> 400
 *   - ?confirm=archive with missing chat_messages_archive table -> 501
 *   - ?confirm=hard without CHAT_HARD_DELETE_TOKEN env          -> 401
 *   - ?confirm=hard with wrong token                            -> 401
 *   - ?confirm=hard with correct token                          -> 200 and
 *     the underlying chat_messages delete was invoked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Captures for assertions. We reset these in beforeEach.
const captured = {
  selectCalls: 0,
  insertCalls: [] as Array<{ table: string; rows: unknown }>,
  deleteCalls: [] as Array<{ table: string }>,
  // What the mock should return for the initial select (archive path).
  selectRows: [] as Array<Record<string, unknown>>,
  // If set, the mock archive insert returns this error.
  archiveInsertError: null as { code?: string; message?: string } | null,
}

vi.mock('@/lib/supabase', () => {
  const buildQuery = (table: string) => {
    let mode: 'idle' | 'delete' | 'select' | 'insert' = 'idle'

    const chain: Record<string, unknown> = {
      select: (_cols?: string) => {
        mode = 'select'
        captured.selectCalls += 1
        // Support both `.select('*')` as a thenable (archive path uses
        // `await supabase.from(...).select('*')`) and further chaining
        // (ordering/eq/limit) used by GET.
        const thenable = {
          then: (
            resolve: (v: {
              data: Array<Record<string, unknown>>
              error: null
            }) => unknown,
          ) => resolve({ data: captured.selectRows, error: null }),
          order: () => ({
            limit: async () => ({ data: captured.selectRows, error: null }),
          }),
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }
        return thenable
      },
      insert: async (rows: unknown) => {
        mode = 'insert'
        captured.insertCalls.push({ table, rows })
        if (table === 'chat_messages_archive' && captured.archiveInsertError) {
          return { data: null, error: captured.archiveInsertError }
        }
        return { data: null, error: null }
      },
      delete: () => {
        mode = 'delete'
        captured.deleteCalls.push({ table })
        const deleteChain: Record<string, unknown> = {
          neq: async () => ({ data: null, error: null }),
        }
        void mode
        return deleteChain
      },
    }
    return chain
  }

  return {
    createServiceClient: () => ({
      from: (table: string) => buildQuery(table),
    }),
    supabase: {},
  }
})

import { DELETE } from '../history/route'

const APP_TOKEN = 'chat-history-test-token'

function makeReq(url: string): Request {
  // Every authenticated DELETE now requires requireAuth. Send the
  // session token as Authorization: Bearer on every test request.
  return new Request(url, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${APP_TOKEN}` },
  })
}

describe('DELETE /api/chat/history guard', () => {
  const ORIGINAL_HARD = process.env.CHAT_HARD_DELETE_TOKEN
  const ORIGINAL_APP = process.env.APP_AUTH_TOKEN

  beforeEach(() => {
    captured.selectCalls = 0
    captured.insertCalls = []
    captured.deleteCalls = []
    captured.selectRows = []
    captured.archiveInsertError = null
    process.env.APP_AUTH_TOKEN = APP_TOKEN
  })

  afterEach(() => {
    if (ORIGINAL_HARD === undefined) {
      delete process.env.CHAT_HARD_DELETE_TOKEN
    } else {
      process.env.CHAT_HARD_DELETE_TOKEN = ORIGINAL_HARD
    }
    if (ORIGINAL_APP === undefined) {
      delete process.env.APP_AUTH_TOKEN
    } else {
      process.env.APP_AUTH_TOKEN = ORIGINAL_APP
    }
  })

  it('returns 401 when no Bearer session token is sent', async () => {
    const noAuth = new Request('http://localhost:3005/api/chat/history', {
      method: 'DELETE',
    })
    const res = await DELETE(noAuth)
    expect(res.status).toBe(401)
    expect(captured.deleteCalls.length).toBe(0)
  })

  it('returns 400 when called with no params', async () => {
    const res = await DELETE(makeReq('http://localhost:3005/api/chat/history'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/confirm=archive/)
    expect(body.error).toMatch(/confirm=hard/)
    expect(captured.deleteCalls.length).toBe(0)
  })

  it('returns 501 when ?confirm=archive runs against a missing chat_messages_archive table', async () => {
    captured.selectRows = [
      { id: 'm1', role: 'user', content: 'hello', created_at: '2026-04-01' },
    ]
    captured.archiveInsertError = {
      code: '42P01',
      message:
        'relation "public.chat_messages_archive" does not exist (PostgrestError)',
    }

    const res = await DELETE(
      makeReq('http://localhost:3005/api/chat/history?confirm=archive'),
    )
    expect(res.status).toBe(501)
    const body = await res.json()
    expect(body.error).toMatch(/Wave 3 migration/)
    // critical: no delete was invoked when archive failed
    expect(captured.deleteCalls.length).toBe(0)
    // the archive insert was attempted
    expect(
      captured.insertCalls.some((c) => c.table === 'chat_messages_archive'),
    ).toBe(true)
  })

  it('returns 401 when ?confirm=hard is used but CHAT_HARD_DELETE_TOKEN env var is not set', async () => {
    delete process.env.CHAT_HARD_DELETE_TOKEN

    const res = await DELETE(
      makeReq(
        'http://localhost:3005/api/chat/history?confirm=hard&token=whatever',
      ),
    )
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/CHAT_HARD_DELETE_TOKEN/)
    expect(captured.deleteCalls.length).toBe(0)
  })

  it('returns 401 when ?confirm=hard is called with a wrong token', async () => {
    process.env.CHAT_HARD_DELETE_TOKEN = 'correct-secret'

    const res = await DELETE(
      makeReq(
        'http://localhost:3005/api/chat/history?confirm=hard&token=wrong-secret',
      ),
    )
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/token/)
    expect(captured.deleteCalls.length).toBe(0)
  })

  it('returns 200 and invokes delete when ?confirm=hard is called with the correct env token', async () => {
    process.env.CHAT_HARD_DELETE_TOKEN = 'correct-secret'

    const res = await DELETE(
      makeReq(
        'http://localhost:3005/api/chat/history?confirm=hard&token=correct-secret',
      ),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.mode).toBe('hard')
    // Hard delete MUST hit the chat_messages table.
    expect(
      captured.deleteCalls.some((c) => c.table === 'chat_messages'),
    ).toBe(true)
    // And MUST NOT touch the archive.
    expect(
      captured.insertCalls.some((c) => c.table === 'chat_messages_archive'),
    ).toBe(false)
  })
})
