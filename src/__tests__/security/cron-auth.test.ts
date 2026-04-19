/**
 * Track C — C-001 regression test.
 *
 * Every Vercel cron entry point must reject requests that do not carry
 * a matching `Authorization: Bearer $CRON_SECRET`. Missing env var is
 * treated as fail-closed (no implicit "dev open" path).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { isVercelCron, requireCronAuth } from '@/lib/cron-auth'

const ORIGINAL_SECRET = process.env.CRON_SECRET

function makeReq(headers: Record<string, string> = {}): Request {
  return new Request('https://example.test/api/cron/test', { headers })
}

describe('cron-auth', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret-value-123456'
  })

  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = ORIGINAL_SECRET
  })

  it('rejects when no Authorization header is present', () => {
    expect(isVercelCron(makeReq())).toBe(false)
  })

  it('rejects when bearer value is wrong', () => {
    expect(
      isVercelCron(makeReq({ authorization: 'Bearer nope' })),
    ).toBe(false)
  })

  it('rejects the legacy x-vercel-cron header on its own', () => {
    expect(
      isVercelCron(makeReq({ 'x-vercel-cron': '1' })),
    ).toBe(false)
  })

  it('rejects when scheme is not Bearer', () => {
    expect(
      isVercelCron(
        makeReq({ authorization: 'Basic dGVzdDp0ZXN0' }),
      ),
    ).toBe(false)
  })

  it('accepts the correct bearer', () => {
    expect(
      isVercelCron(
        makeReq({ authorization: 'Bearer test-secret-value-123456' }),
      ),
    ).toBe(true)
  })

  it('fails closed when CRON_SECRET is missing from the environment', () => {
    delete process.env.CRON_SECRET
    expect(
      isVercelCron(
        makeReq({ authorization: 'Bearer anything' }),
      ),
    ).toBe(false)
  })

  it('requireCronAuth returns 401 on failure and null on success', async () => {
    const deny = requireCronAuth(makeReq())
    expect(deny).not.toBeNull()
    expect(deny!.status).toBe(401)

    const ok = requireCronAuth(
      makeReq({ authorization: 'Bearer test-secret-value-123456' }),
    )
    expect(ok).toBeNull()
  })
})
