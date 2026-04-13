// POST /api/analyze/correlations
// Runs the full statistical correlation pipeline across all patient data.
// This is compute-heavy (Spearman correlations with lag analysis, Mann-Whitney tests,
// FDR correction) so we set a 2-minute timeout.

import { NextResponse } from 'next/server'
import { runCorrelationPipeline } from '@/lib/ai/correlation-engine'

export const maxDuration = 120

export async function POST() {
  try {
    const startTime = Date.now()

    const { correlations, totalTests, passingFDR } = await runCorrelationPipeline()

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
    return NextResponse.json(
      { error: 'Correlation analysis failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
