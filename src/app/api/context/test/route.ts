/**
 * Integration Test: Full Context Pipeline
 *
 * GET /api/context/test
 *
 * Runs a comprehensive test suite that verifies the entire
 * three-layer context engine works end-to-end:
 *   1. Permanent Core generation (Layer 1)
 *   2. Topic detection (Layer 2)
 *   3. Full system prompt assembly (Layers 1+2+3)
 *   4. Session handoff system
 *   5. Database connectivity
 */

import { NextResponse } from 'next/server'
import { generatePermanentCore } from '@/lib/context/permanent-core'
import { detectRelevantTopics } from '@/lib/context/summary-engine'
import { getFullSystemPrompt } from '@/lib/context/assembler'
import { getLatestHandoff } from '@/lib/context/handoff'
import { createServiceClient } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth/require-user'
import { resolveUserId, UserIdUnresolvableError } from '@/lib/auth/resolve-user-id'

export const dynamic = 'force-dynamic'
// ── Types ──────────────────────────────────────────────────────────

interface TestDetail {
  [key: string]: unknown
}

interface TestResult {
  status: 'PASS' | 'FAIL'
  details: TestDetail
}

interface TestSuite {
  overall: string
  tests: {
    permanentCore: TestResult
    topicDetection: TestResult
    fullPrompt: TestResult
    handoffSystem: TestResult
    databaseConnectivity: TestResult
  }
  summary: string
}

// ── Test Helpers ───────────────────────────────────────────────────

function pass(details: TestDetail): TestResult {
  return { status: 'PASS', details }
}

function fail(details: TestDetail): TestResult {
  return { status: 'FAIL', details }
}

// ── Test 1: Permanent Core ────────────────────────────────────────

async function testPermanentCore(userId: string): Promise<TestResult> {
  try {
    const core = await generatePermanentCore(userId)

    const checks: Record<string, boolean> = {
      nonEmpty: core.length > 0,
      containsLanae: core.includes('Lanae'),
      containsIronDeficiency: core.includes('Iron deficiency'),
      containsChronicDizziness: core.includes('Chronic dizziness'),
    }

    const tokenEstimate = Math.round(core.length / 4)
    checks.tokenEstimateInRange = tokenEstimate >= 500 && tokenEstimate <= 2000

    const allPassed = Object.values(checks).every(Boolean)

    if (!allPassed) {
      return fail({
        checks,
        tokenEstimate,
        coreLength: core.length,
        corePreview: core.slice(0, 200) + '...',
      })
    }

    return pass({
      checks,
      tokenEstimate,
      coreLength: core.length,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return fail({ error: msg })
  }
}

// ── Test 2: Topic Detection ───────────────────────────────────────

async function testTopicDetection(): Promise<TestResult> {
  try {
    const checks: Record<string, boolean> = {}

    // Query 1: dizzy -> neuro_presyncope (micro-summary topic)
    const dizzinessTopics = detectRelevantTopics('I have been feeling dizzy a lot lately')
    checks.dizziness_has_neuro = dizzinessTopics.some(t => t.startsWith('neuro_'))
    checks.dizziness_has_cv = dizzinessTopics.some(t => t.startsWith('cv_'))

    // Query 2: ferritin labs -> lab_iron_ferritin
    const labTopics = detectRelevantTopics('what did my ferritin labs show?')
    checks.ferritin_has_lab_iron = labTopics.includes('lab_iron_ferritin')

    // Query 3: food triggers -> gi_food_triggers
    const foodTopics = detectRelevantTopics('any food triggers this month?')
    checks.food_has_gi_triggers = foodTopics.includes('gi_food_triggers')

    const allPassed = Object.values(checks).every(Boolean)

    if (!allPassed) {
      return fail({
        checks,
        dizzinessTopics,
        labTopics,
        foodTopics,
      })
    }

    return pass({
      checks,
      dizzinessTopics,
      labTopics,
      foodTopics,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return fail({ error: msg })
  }
}

// ── Test 3: Full System Prompt Assembly ───────────────────────────

async function testFullPrompt(userId: string): Promise<TestResult> {
  try {
    const result = await getFullSystemPrompt(
      'What patterns do you see in my health data?',
      { userId, skipRetrieval: true }, // skip vector search to avoid dependency on health_embeddings data
    )

    const prompt = result.systemPrompt

    const checks: Record<string, boolean> = {
      hasSystemPromptString: typeof prompt === 'string' && prompt.length > 0,
      hasDynamicBoundary: prompt.includes('__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__'),
      hasPatientContext: prompt.includes('<patient_context>'),
      hasSelfDistrust: prompt.includes('SELF-DISTRUST PRINCIPLE'),
    }

    const tokenEstimate = result.tokenEstimate
    checks.tokenEstimateInRange = tokenEstimate >= 1000 && tokenEstimate <= 60000

    const allPassed = Object.values(checks).every(Boolean)

    if (!allPassed) {
      return fail({
        checks,
        tokenEstimate,
        charCount: result.charCount,
        promptPreview: prompt.slice(0, 300) + '...',
        sectionsLoaded: {
          permanentCore: result.sections.permanentCore !== null,
          handoff: result.sections.handoff !== null,
          summaryCount: result.sections.summaries.length,
          retrieval: result.sections.retrieval !== null,
        },
      })
    }

    return pass({
      checks,
      tokenEstimate,
      charCount: result.charCount,
      sectionsLoaded: {
        permanentCore: result.sections.permanentCore !== null,
        handoff: result.sections.handoff !== null,
        summaryCount: result.sections.summaries.length,
        summaryTopics: result.sections.summaries.map((s) => s.topic),
        retrieval: result.sections.retrieval !== null,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return fail({ error: msg })
  }
}

// ── Test 4: Handoff System ────────────────────────────────────────

async function testHandoffSystem(): Promise<TestResult> {
  try {
    const handoff = await getLatestHandoff()

    // Valid outcomes: null (no handoffs yet) or a valid object
    if (handoff === null) {
      return pass({
        result: 'null (no handoffs stored yet)',
        valid: true,
      })
    }

    // If we got an object, verify it has expected shape
    const checks: Record<string, boolean> = {
      hasSessionType: typeof handoff.session_type === 'string',
      hasAccomplished: typeof handoff.what_accomplished === 'string',
      hasDiscovered: typeof handoff.what_discovered === 'string',
      hasCreatedAt: typeof handoff.created_at === 'string',
    }

    const allPassed = Object.values(checks).every(Boolean)

    if (!allPassed) {
      return fail({
        checks,
        handoffKeys: Object.keys(handoff),
      })
    }

    return pass({
      checks,
      sessionType: handoff.session_type,
      createdAt: handoff.created_at,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return fail({ error: msg })
  }
}

// ── Test 5: Database Connectivity ─────────────────────────────────

async function testDatabaseConnectivity(userId: string): Promise<TestResult> {
  try {
    const sb = createServiceClient()

    const [hpResult, apResult, mtResult] = await Promise.all([
      sb.from('health_profile').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      sb.from('active_problems').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      sb.from('medical_timeline').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    ])

    if (hpResult.error) throw new Error(`health_profile: ${hpResult.error.message}`)
    if (apResult.error) throw new Error(`active_problems: ${apResult.error.message}`)
    if (mtResult.error) throw new Error(`medical_timeline: ${mtResult.error.message}`)

    const hpCount = hpResult.count ?? 0
    const apCount = apResult.count ?? 0
    const mtCount = mtResult.count ?? 0

    const checks: Record<string, boolean> = {
      healthProfileMinRows: hpCount >= 9,
      activeProblemsMinRows: apCount >= 6,
      medicalTimelineMinRows: mtCount >= 7,
    }

    const allPassed = Object.values(checks).every(Boolean)

    if (!allPassed) {
      return fail({
        checks,
        counts: {
          health_profile: hpCount,
          active_problems: apCount,
          medical_timeline: mtCount,
        },
      })
    }

    return pass({
      checks,
      counts: {
        health_profile: hpCount,
        active_problems: apCount,
        medical_timeline: mtCount,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return fail({ error: msg })
  }
}

// ── Route Handler ─────────────────────────────────────────────────

export async function GET(request: Request) {
  const gate = requireAuth(request)
  if (!gate.ok) return gate.response

  let userId: string
  try {
    const r = await resolveUserId()
    userId = r.userId
  } catch (err) {
    if (err instanceof UserIdUnresolvableError) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }
    return NextResponse.json({ error: 'auth check failed' }, { status: 500 })
  }

  // Run all tests (each wrapped in its own try/catch internally)
  const [permanentCore, topicDetection, fullPrompt, handoffSystem, databaseConnectivity] =
    await Promise.all([
      testPermanentCore(userId),
      testTopicDetection(),
      testFullPrompt(userId),
      testHandoffSystem(),
      testDatabaseConnectivity(userId),
    ])

  const tests = {
    permanentCore,
    topicDetection,
    fullPrompt,
    handoffSystem,
    databaseConnectivity,
  }

  const passedCount = Object.values(tests).filter((t) => t.status === 'PASS').length
  const totalCount = Object.keys(tests).length

  const result: TestSuite = {
    overall: passedCount === totalCount ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED',
    tests,
    summary: `${passedCount}/${totalCount} tests passed`,
  }

  return NextResponse.json(result, {
    status: passedCount === totalCount ? 200 : 500,
  })
}
