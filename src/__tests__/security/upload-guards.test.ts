/**
 * Track C - C-004 regression test.
 *
 * Validates upload-guard helpers used by import and file-upload routes.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  enforceDeclaredSize,
  enforceActualSize,
  guardUpload,
} from '@/lib/upload-guard'
import { rateLimit } from '@/lib/rate-limit'

beforeEach(() => {
  process.env.RATE_LIMIT_IN_TESTS = '1'
})

afterEach(() => {
  delete process.env.RATE_LIMIT_IN_TESTS
})

function reqWith(headers: Record<string, string> = {}): Request {
  return new Request('https://example.test/upload', { method: 'POST', headers })
}

describe('upload-guard', () => {
  it('returns 413 when declared size exceeds the cap', () => {
    const res = enforceDeclaredSize(reqWith({ 'content-length': '99999999' }), 1024)
    expect(res).not.toBeNull()
    expect(res!.status).toBe(413)
  })

  it('returns null when declared size is within cap', () => {
    expect(enforceDeclaredSize(reqWith({ 'content-length': '512' }), 1024)).toBeNull()
  })

  it('returns 413 when the actual measured size exceeds cap', () => {
    expect(enforceActualSize(1025, 1024)!.status).toBe(413)
    expect(enforceActualSize(1024, 1024)).toBeNull()
  })

  it('guardUpload rate-limits', () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 2 })
    const req = reqWith({ 'x-forwarded-for': '1.2.3.4' })
    expect(guardUpload(req, { maxBytes: 1024, rateLimiter: limiter })).toBeNull()
    expect(guardUpload(req, { maxBytes: 1024, rateLimiter: limiter })).toBeNull()
    const third = guardUpload(req, { maxBytes: 1024, rateLimiter: limiter })
    expect(third).not.toBeNull()
    expect(third!.status).toBe(429)
  })
})
