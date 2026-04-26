/**
 * Regression tests for Track B P0 lock-in: every PHI-bearing route in
 * scope now returns 401 when called without a session token.
 *
 * These tests mock @/lib/supabase so the route handlers never hit a real
 * DB and run in under a second. The goal is narrow: verify the FIRST
 * thing each handler does is refuse unauthenticated access. Body-level
 * behavior is covered by other suites.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---- Supabase stub -----------------------------------------------------
//
// Every `from(table).select(...).order(...)` pattern must resolve to an
// empty result so downstream code does not explode if a route falls
// through. The auth check should short-circuit BEFORE any query runs.

vi.mock('@/lib/supabase', () => {
  const emptyResult = async () => ({ data: [], error: null })
  const chain = (): unknown => ({
    select: () => chain(),
    eq: () => chain(),
    in: () => chain(),
    neq: () => chain(),
    gte: () => chain(),
    lte: () => chain(),
    not: () => chain(),
    order: () => ({
      ...emptyResult,
      then: (r: (v: { data: unknown[]; error: null }) => unknown) =>
        r({ data: [], error: null }),
    }),
    limit: () => ({
      then: (r: (v: { data: unknown[]; error: null }) => unknown) =>
        r({ data: [], error: null }),
    }),
    single: async () => ({ data: null, error: null }),
    maybeSingle: async () => ({ data: null, error: null }),
    insert: async () => ({ data: null, error: null }),
    upsert: async () => ({ data: null, error: null }),
    update: async () => ({ data: null, error: null }),
    delete: () => chain(),
    then: (r: (v: { data: unknown[]; error: null }) => unknown) =>
      r({ data: [], error: null }),
  })
  return {
    createServiceClient: () => ({ from: () => chain() }),
    supabase: new Proxy({}, { get: () => () => chain() }),
  }
})

// Stub privacy prefs so any context assembly that tries to read prefs
// returns defaults (prevents calls from reaching Anthropic in practice,
// but also prevents import-time crashes in test env).
vi.mock('@/lib/api/privacy-prefs', () => ({
  getPrivacyPrefs: async () => ({
    allow_claude_context: false,
    allow_correlation_analysis: false,
    retain_history_beyond_2y: true,
  }),
}))

// Stub the Anthropic SDK to prevent accidental network calls.
vi.mock('@anthropic-ai/sdk', () => {
  class Anthropic {
    messages = {
      create: vi.fn(async () => ({
        content: [{ type: 'text', text: 'mocked' }],
        stop_reason: 'end_turn',
      })),
    }
  }
  return { default: Anthropic, Anthropic }
})

// ---- Imports after mocks ----------------------------------------------

import { GET as exportGet } from '@/app/api/export/route'
import { GET as reportsDoctorGet } from '@/app/api/reports/doctor/route'
import { GET as reportsConditionGet } from '@/app/api/reports/condition/route'
import { GET as narrativeGet, PUT as narrativePut } from '@/app/api/narrative/route'
import { GET as narrativeWeeklyGet, POST as narrativeWeeklyPost } from '@/app/api/narrative/weekly/route'
import { POST as chatPost } from '@/app/api/chat/route'
import { POST as coachPost } from '@/app/api/chat/nutrition-coach/route'
import { GET as chatHistoryGet } from '@/app/api/chat/history/route'
import { POST as transcribePost } from '@/app/api/transcribe/route'
import { POST as correlationsPost } from '@/app/api/analyze/correlations/route'
import { GET as flareGet } from '@/app/api/analyze/flare-risk/route'
import { POST as intelligencePost } from '@/app/api/intelligence/analyze/route'
import { NextRequest } from 'next/server'
import { resetRateLimitsForTests } from '@/lib/security/rate-limit'

function plainReq(url: string, init: RequestInit = {}): Request {
  return new Request(url, init)
}

function nextReq(url: string, init: RequestInit = {}): NextRequest {
  return new NextRequest(new URL(url), init as unknown as ConstructorParameters<typeof NextRequest>[1])
}

describe('Track B - PHI routes require auth', () => {
  const ORIGINAL_TOKEN = process.env.APP_AUTH_TOKEN
  const ORIGINAL_BYPASS = process.env.APP_AUTH_BYPASS
  const ORIGINAL_OPENAI = process.env.OPENAI_API_KEY

  beforeEach(() => {
    // Ensure there is NO auth bypass, and the token env is set so the
    // gate rejects missing / wrong credentials with 401 (not 500).
    process.env.APP_AUTH_TOKEN = 'a'.repeat(40)
    delete process.env.APP_AUTH_BYPASS
    process.env.OPENAI_API_KEY = 'sk-fake'
    resetRateLimitsForTests()
  })

  afterEach(() => {
    if (ORIGINAL_TOKEN === undefined) delete process.env.APP_AUTH_TOKEN
    else process.env.APP_AUTH_TOKEN = ORIGINAL_TOKEN
    if (ORIGINAL_BYPASS === undefined) delete process.env.APP_AUTH_BYPASS
    else process.env.APP_AUTH_BYPASS = ORIGINAL_BYPASS
    if (ORIGINAL_OPENAI === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = ORIGINAL_OPENAI
  })

  it('GET /api/export without a session -> 401', async () => {
    const res = await exportGet(nextReq('http://localhost/api/export'))
    expect(res.status).toBe(401)
  })

  it('GET /api/reports/doctor without a session -> 401', async () => {
    const res = await reportsDoctorGet(nextReq('http://localhost/api/reports/doctor'))
    expect(res.status).toBe(401)
  })

  it('GET /api/reports/condition without a session -> 401', async () => {
    const res = await reportsConditionGet(
      nextReq('http://localhost/api/reports/condition?type=pots'),
    )
    expect(res.status).toBe(401)
  })

  it('GET /api/narrative without a session -> 401', async () => {
    const res = await narrativeGet(plainReq('http://localhost/api/narrative'))
    expect(res.status).toBe(401)
  })

  it('PUT /api/narrative without a session -> 401', async () => {
    const res = await narrativePut(
      plainReq('http://localhost/api/narrative', {
        method: 'PUT',
        body: JSON.stringify({ section_title: 't', content: 'x', section_order: 1 }),
      }),
    )
    expect(res.status).toBe(401)
  })

  it('GET /api/narrative/weekly without a session -> 401', async () => {
    const res = await narrativeWeeklyGet(plainReq('http://localhost/api/narrative/weekly'))
    expect(res.status).toBe(401)
  })

  it('POST /api/narrative/weekly without a session -> 401', async () => {
    const res = await narrativeWeeklyPost(
      plainReq('http://localhost/api/narrative/weekly', { method: 'POST' }),
    )
    expect(res.status).toBe(401)
  })

  it('POST /api/chat without a session -> 401', async () => {
    const res = await chatPost(
      plainReq('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: 'hello' }),
      }),
    )
    expect(res.status).toBe(401)
  })

  it('POST /api/chat/nutrition-coach without a session -> 401', async () => {
    const res = await coachPost(
      plainReq('http://localhost/api/chat/nutrition-coach', {
        method: 'POST',
        body: JSON.stringify({ message: 'hello' }),
      }),
    )
    expect(res.status).toBe(401)
  })

  it('GET /api/chat/history without a session -> 401', async () => {
    const res = await chatHistoryGet(plainReq('http://localhost/api/chat/history'))
    expect(res.status).toBe(401)
  })

  it('POST /api/transcribe without a session -> 401', async () => {
    const form = new FormData()
    form.append('audio', new Blob(['a'], { type: 'audio/webm' }), 'a.webm')
    const res = await transcribePost(
      nextReq('http://localhost/api/transcribe', { method: 'POST', body: form }),
    )
    expect(res.status).toBe(401)
  })

  it('POST /api/analyze/correlations without a session -> 401', async () => {
    const res = await correlationsPost(
      plainReq('http://localhost/api/analyze/correlations', { method: 'POST' }),
    )
    expect(res.status).toBe(401)
  })

  it('GET /api/analyze/flare-risk without a session -> 401', async () => {
    const res = await flareGet(plainReq('http://localhost/api/analyze/flare-risk'))
    expect(res.status).toBe(401)
  })

  it('POST /api/intelligence/analyze without a session -> 401', async () => {
    const res = await intelligencePost(
      plainReq('http://localhost/api/intelligence/analyze', {
        method: 'POST',
        body: JSON.stringify({ mode: 'standard', reason: 'test' }),
      }),
    )
    expect(res.status).toBe(401)
  })
})
