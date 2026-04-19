/**
 * Track C — C-006 regression test for safeFetch.
 *
 * Covers:
 *  - AbortController-backed timeout.
 *  - Response body size cap (both declared and streamed).
 *  - Content-type allowlist.
 *  - Ordinary happy path.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { safeFetch, SafeFetchError } from '@/lib/safe-fetch'

afterEach(() => {
  vi.restoreAllMocks()
})

function responseWith(opts: {
  body?: string
  status?: number
  contentType?: string
  contentLength?: string
}): Response {
  const headers = new Headers()
  if (opts.contentType) headers.set('content-type', opts.contentType)
  if (opts.contentLength) headers.set('content-length', opts.contentLength)
  return new Response(opts.body ?? '{}', {
    status: opts.status ?? 200,
    headers,
  })
}

describe('safeFetch', () => {
  it('returns the response on happy path and buffers the body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      responseWith({ body: '{"ok": true}', contentType: 'application/json' }),
    )
    const res = await safeFetch('https://up.test/x', { contentTypes: ['application/json'] })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: true })
  })

  it('rejects on disallowed content-type', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      responseWith({ body: '<html></html>', contentType: 'text/html' }),
    )
    await expect(
      safeFetch('https://up.test/x', { contentTypes: ['application/json'] }),
    ).rejects.toBeInstanceOf(SafeFetchError)
  })

  it('rejects when declared content-length exceeds cap', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      responseWith({
        body: 'x'.repeat(10),
        contentType: 'application/json',
        contentLength: '99999999',
      }),
    )
    await expect(
      safeFetch('https://up.test/x', { maxBytes: 1024 }),
    ).rejects.toMatchObject({ code: 'too_large' })
  })

  it('rejects when streamed body exceeds cap', async () => {
    const big = 'x'.repeat(5000)
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(big, {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    await expect(
      safeFetch('https://up.test/x', { maxBytes: 1024 }),
    ).rejects.toMatchObject({ code: 'too_large' })
  })

  it('times out if upstream never resolves', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'))
          })
        }),
    )
    await expect(
      safeFetch('https://up.test/slow', { timeoutMs: 20 }),
    ).rejects.toMatchObject({ code: 'timeout' })
  })
})
