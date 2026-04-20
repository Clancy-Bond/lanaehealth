// POST /api/analyze/correlations
// Runs the full statistical correlation pipeline across all patient data.
// This is compute-heavy (Spearman correlations with lag analysis, Mann-Whitney tests,
// FDR correction) so we set a 2-minute timeout.

import { NextResponse } from 'next/server'
import { runCorrelationPipeline } from '@/lib/ai/correlation-engine'
import { requireAuth } from '@/lib/auth/require-user'
import { checkRateLimit, clientIdFromRequest } from '@/lib/security/rate-limit'
import { recordAuditEvent, auditMetaFromRequest } from '@/lib/security/audit-log'

export const maxDuration = 120

export async function POST(request: Request) {
  const audit = auditMetaFromRequest(request)
  const auth = requireAuth(request)
  if (!auth.ok) {
    await recordAuditEvent({
      endpoint: 'POST /api/analyze/correlations',
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
    scope: 'analyze:correlations',
    max: 4,
    windowMs: 60 * 60 * 1000,
    key: clientIdFromRequest(request),
  })
  if (!limit.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })
  }

  try {
    const startTime = Date.now()

    const { correlations, totalTests, passingFDR, upsertedCount, newCount } =
      await runCorrelationPipeline()

    const elapsedMs = Date.now() - startTime

    // Top findings: passed FDR, sorted by effect size descending
    const topFindings = correlations
      .filter(c => c.passed_fdr)
      .slice(0, 20)
      .map(c => ({
        factorA: c.factor_a,
        factorB: c.factor_b,
        type: c.correlation_type,
        coefficient: c.coefficient,
        pValue: c.p_value,
        effectSize: c.effect_size,
        description: c.effect_description,
        confidence: c.confidence_level,
        sampleSize: c.sample_size,
        lagDays: c.lag_days,
      }))

    return NextResponse.json({
      totalTests,
      passingFDR,
      upsertedCount,
      newCount,
      elapsedMs,
      topFindings,
      correlations: correlations.map(c => ({
        factorA: c.factor_a,
        factorB: c.factor_b,
        type: c.correlation_type,
        coefficient: c.coefficient,
        pValue: c.p_value,
        effectSize: c.effect_size,
        description: c.effect_description,
        confidence: c.confidence_level,
        sampleSize: c.sample_size,
        lagDays: c.lag_days,
        passedFDR: c.passed_fdr,
      })),
    })
  } catch (error) {
    console.error('Correlation pipeline error:', error)
    await recordAuditEvent({
      endpoint: 'POST /api/analyze/correlations',
      actor: `via:`,
      outcome: 'error',
      status: 500,
      reason: 'pipeline',
      ip: audit.ip,
      userAgent: audit.userAgent,
    })
    return NextResponse.json(
      { error: 'Correlation analysis failed' },
      { status: 500 }
    )
  }
}
