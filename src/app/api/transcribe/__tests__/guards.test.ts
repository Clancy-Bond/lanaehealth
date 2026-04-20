/**
 * Regression tests for Track B hardening of /api/transcribe:
 *   - unauthenticated requests return 401
 *   - oversize uploads are refused with 413 BEFORE the body is parsed
 *   - non-audio content-types are refused with 415
 *   - Whisper upstream errors do not echo the upstream body to the client
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../route'
import { resetRateLimitsForTests } from '@/lib/security/rate-limit'

function fakeReq(init: {
  headers?: Record<string, string>
  body?: FormData | string | null
} = {}): NextRequest {
  const headers = new Headers(init.headers ?? {})
  return new NextRequest(new URL('http://localhost/api/transcribe'), {
    method: 'POST',
    headers,
    body: init.body ?? null,
  } as RequestInit & { duplex?: 'half' })
}

describe('POST /api/transcribe guards', () => {
  const ORIGINAL_TOKEN = process.env.APP_AUTH_TOKEN
  const ORIGINAL_OPENAI = process.env.OPENAI_API_KEY
  const ORIGINAL_FETCH = global.fetch

  beforeEach(() => {
    process.env.APP_AUTH_TOKEN = 'a'.repeat(40)
    process.env.OPENAI_API_KEY = 'sk-fake'
    resetRateLimitsForTests()
  })

  afterEach(() => {
    if (ORIGINAL_TOKEN === undefined) delete process.env.APP_AUTH_TOKEN
    else process.env.APP_AUTH_TOKEN = ORIGINAL_TOKEN
    if (ORIGINAL_OPENAI === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = ORIGINAL_OPENAI
    global.fetch = ORIGINAL_FETCH
    vi.restoreAllMocks()
  })

  it('rejects unauthenticated requests', async () => {
    const res = await POST(fakeReq({}))
    expect(res.status).toBe(401)
  })

  it('rejects oversize payloads before parsing the body', async () => {
    const headers = {
      authorization: 'Bearer ' + 'a'.repeat(40),
      'content-length': String(100 * 1024 * 1024),
    }
    const res = await POST(fakeReq({ headers }))
    expect(res.status).toBe(413)
  })

  it('rejects non-audio content-types', async () => {
    const form = new FormData()
    form.append('audio', new Blob(['x'], { type: 'text/plain' }), 'evil.txt')
    const res = await POST(
      fakeReq({
        headers: { authorization: 'Bearer ' + 'a'.repeat(40) },
        body: form,
      }),
    )
    expect(res.status).toBe(415)
  })

  it('does not echo the Whisper error body back to the client', async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        'Whisper says: filename "Lanae-cycle-notes-unredacted.webm" is invalid',
        { status: 400, statusText: 'Bad Request' },
      ),
    ) as typeof fetch

    const form = new FormData()
    form.append('audio', new Blob(['x'], { type: 'audio/webm' }), 'audio.webm')
    const res = await POST(
      fakeReq({
        headers: { authorization: 'Bearer ' + 'a'.repeat(40) },
        body: form,
      }),
    )
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toBe('Whisper returned 400')
    // Critically, the patient-identifiable filename must NOT be in the
    // response body. The server logs it internally.
    expect(JSON.stringify(body)).not.toMatch(/Lanae/)
    expect(JSON.stringify(body)).not.toMatch(/cycle-notes/)
  })
})
