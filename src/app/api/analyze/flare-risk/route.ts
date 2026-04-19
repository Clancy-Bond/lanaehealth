// GET /api/analyze/flare-risk
// Runs the upgraded flare risk assessment for today.
// Fetches all aligned biometric + symptom data, then computes:
//   - Extended lag analysis (-7 to +7 days)
//   - Event-triggered flare signature
//   - Cycle-phase stratified correlations
//   - Composite risk probability with contributing factors

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { alignData, assessFlareRisk } from '@/lib/ai/flare-model'
import type { DailyLog, OuraDaily, Symptom, CycleEntry } from '@/lib/types'
import { requireUser } from '@/lib/auth/require-user'
import { checkRateLimit, clientIdFromRequest } from '@/lib/security/rate-limit'
import { recordAuditEvent, auditMetaFromRequest } from '@/lib/security/audit-log'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const audit = auditMetaFromRequest(request)
  const auth = await requireUser(request)
  if (!auth.ok) {
    await recordAuditEvent({
      endpoint: 'GET /api/analyze/flare-risk',
      actor: audit.ip ?? 'unauthenticated',
      outcome: 'deny',
      status: 401,
      reason: 'auth',
      ip: audit.ip,
      userAgent: audit.userAgent,
    })
    return auth.response
  }

  const limit = checkRateLimit({
    scope: 'analyze:flare-risk',
    max: 30,
    windowMs: 60 * 60 * 1000,
    key: clientIdFromRequest(request),
  })
  if (!limit.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })
  }

  try {
    const supabase = createServiceClient()
    const startTime = Date.now()

    // Fetch all required data in parallel
    const [logsRes, ouraRes, symptomsRes, cycleRes] = await Promise.all([
      supabase
        .from('daily_logs')
        .select('*')
        .order('date', { ascending: true }),
      supabase
        .from('oura_daily')
        .select('*')
        .order('date', { ascending: true }),
      supabase
        .from('symptoms')
        .select('*'),
      supabase
        .from('cycle_entries')
        .select('*')
        .order('date', { ascending: true }),
    ])

    if (logsRes.error) throw new Error(`daily_logs query failed: ${logsRes.error.message}`)
    if (ouraRes.error) throw new Error(`oura_daily query failed: ${ouraRes.error.message}`)
    if (symptomsRes.error) throw new Error(`symptoms query failed: ${symptomsRes.error.message}`)
    if (cycleRes.error) throw new Error(`cycle_entries query failed: ${cycleRes.error.message}`)

    const dailyLogs = (logsRes.data || []) as DailyLog[]
    const ouraData = (ouraRes.data || []) as OuraDaily[]
    const symptoms = (symptomsRes.data || []) as Symptom[]
    const cycleEntries = (cycleRes.data || []) as CycleEntry[]

    // Align all data sources
    const aligned = alignData(dailyLogs, ouraData, symptoms, cycleEntries)

    if (aligned.length < 14) {
      return NextResponse.json(
        { error: 'Insufficient data', details: `Need at least 14 aligned days, found ${aligned.length}` },
        { status: 400 }
      )
    }

    // Run the full flare risk assessment
    const assessment = assessFlareRisk(aligned)

    if (!assessment) {
      return NextResponse.json(
        { error: 'Unable to assess risk', details: 'Not enough flare events or baseline data to build a prediction model' },
        { status: 400 }
      )
    }

    const elapsedMs = Date.now() - startTime

    return NextResponse.json({
      riskPercent: assessment.riskPercent,
      riskLevel: assessment.riskLevel,
      contributingFactors: assessment.contributingFactors,
      flareSignature: {
        flareCount: assessment.flareSignature.flareCount,
        metrics: assessment.flareSignature.metrics,
        baselineAvg: assessment.flareSignature.baselineAvg,
      },
      optimalLags: assessment.optimalLags.map(lag => ({
        metric: lag.metric,
        bestLag: lag.bestLag,
        bestCorrelation: lag.bestCorrelation,
        sampleSize: lag.sampleSize,
        interpretation: lag.interpretation,
      })),
      phaseAnalysis: assessment.phaseAnalysis.map(pa => ({
        phase: pa.phase,
        flareRate: pa.flareRate,
        dayCount: pa.dayCount,
        topPatterns: pa.patterns.slice(0, 5).map(p => ({
          metric: p.metric,
          lagDays: p.lagDays,
          correlation: p.correlationStrength,
          direction: p.direction,
          description: p.description,
        })),
      })),
      lastAssessed: assessment.lastAssessed,
      metadata: {
        alignedDays: aligned.length,
        elapsedMs,
      },
    })
  } catch (error) {
    console.error('Flare risk assessment error:', error)
    return NextResponse.json(
      { error: 'Flare risk assessment failed' },
      { status: 500 }
    )
  }
}
