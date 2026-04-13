// AI Analysis Engine - Orchestrator
// Calls Claude API for each analysis type using pipeline evidence

import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PROMPTS, type AnalysisType } from './prompts'
import { prepareAnalysisContext, computeInputHash } from './data-prep'
import { getCachedAnalysis, createAnalysisRun, saveAnalysisResults, failAnalysisRun } from './cache'
import type { PipelineInput, AnalysisFinding, PipelineResult, InsightCategory, RunType } from '@/lib/types'

const ANALYSIS_MODEL = 'claude-sonnet-4-20250514'

/**
 * Run a single analysis type against Claude.
 */
async function runSingleAnalysis(
  client: Anthropic,
  analysisType: AnalysisType,
  context: Record<string, unknown>
): Promise<Omit<AnalysisFinding, 'id' | 'run_id' | 'created_at'>[]> {
  try {
    const systemPrompt = SYSTEM_PROMPTS[analysisType]
    const userMessage = JSON.stringify(context, null, 2)

    // Estimate tokens and truncate if needed (rough: 1 token ~= 4 chars)
    const estimatedTokens = userMessage.length / 4
    const maxInputChars = 400000 // ~100K tokens
    const truncatedMessage = userMessage.length > maxInputChars
      ? userMessage.slice(0, maxInputChars) + '\n\n[TRUNCATED - data exceeds token budget]'
      : userMessage

    const response = await client.messages.create({
      model: ANALYSIS_MODEL,
      max_tokens: 4096,
      temperature: 0.3,
      system: systemPrompt,
      messages: [{ role: 'user', content: truncatedMessage }],
    })

    // Extract text content
    const textBlock = response.content.find(c => c.type === 'text')
    if (!textBlock || textBlock.type !== 'text') return []

    // Parse JSON response
    const jsonText = textBlock.text.trim()
    // Handle potential markdown code blocks
    const cleaned = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '')
    const parsed = JSON.parse(cleaned)

    const findings = (parsed.findings || []) as Omit<AnalysisFinding, 'id' | 'run_id' | 'created_at'>[]

    // Ensure category is set correctly
    return findings.map(f => ({
      ...f,
      category: (f.category || analysisType) as InsightCategory,
      confidence: Math.max(0, Math.min(1, f.confidence || 0)),
      clinical_significance: f.clinical_significance || 'low',
      evidence_json: f.evidence_json || {},
    }))
  } catch (err) {
    console.error(`Analysis ${analysisType} failed:`, err)
    return []
  }
}

/**
 * Run the full AI analysis pipeline.
 * Checks cache first, then runs all analysis types in parallel.
 */
export async function runFullAnalysis(
  input: PipelineInput,
  apiEvidence: Record<string, unknown> = {},
  runType: RunType = 'full'
): Promise<PipelineResult> {
  const startTime = Date.now()
  const inputHash = computeInputHash(input)
  const errors: string[] = []

  // Check cache
  const cached = await getCachedAnalysis(runType, inputHash)
  if (cached) {
    const byCategory = groupByCategory(cached.findings)
    return {
      runId: cached.run.id,
      status: 'complete',
      findings: cached.findings,
      findingsByCategory: byCategory,
      metadata: {
        apiCallCount: 0,
        cacheHitRate: 1,
        processingTimeMs: Date.now() - startTime,
        errors: [],
      },
    }
  }

  // Create run record
  const runId = await createAnalysisRun(runType, inputHash)
  if (!runId) {
    return emptyResult('Failed to create analysis run')
  }

  // Check for API key
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    await failAnalysisRun(runId, 'ANTHROPIC_API_KEY not set')
    return emptyResult('ANTHROPIC_API_KEY not set')
  }

  const client = new Anthropic({ apiKey })

  // Prepare context
  const context = prepareAnalysisContext(input, apiEvidence)

  // Determine which analyses to run based on type
  const analysisTypes: AnalysisType[] = runType === 'full'
    ? ['diagnostic', 'biomarker', 'pathway', 'medication', 'flare', 'food', 'research']
    : [runType as AnalysisType]

  // Run analyses in parallel
  const results = await Promise.allSettled(
    analysisTypes.map(type =>
      runSingleAnalysis(client, type, {
        ...context,
        apiEvidence: apiEvidence[type] || apiEvidence,
      })
    )
  )

  // Collect all findings
  const allFindings: Omit<AnalysisFinding, 'id' | 'run_id' | 'created_at'>[] = []
  let apiCallCount = 0

  for (let i = 0; i < results.length; i++) {
    apiCallCount++
    const result = results[i]
    if (result.status === 'fulfilled') {
      allFindings.push(...result.value)
    } else {
      errors.push(`${analysisTypes[i]}: ${result.reason}`)
    }
  }

  // Save results
  await saveAnalysisResults(runId, allFindings, {
    apiCallCount,
    analysisTypes,
    processingTimeMs: Date.now() - startTime,
    errors,
  })

  // Fetch saved findings (with IDs)
  const { createServiceClient } = await import('@/lib/supabase')
  const supabase = createServiceClient()
  const { data: savedFindings } = await supabase
    .from('analysis_findings')
    .select('*')
    .eq('run_id', runId)
    .order('confidence', { ascending: false })

  const findings = (savedFindings || []) as AnalysisFinding[]
  const byCategory = groupByCategory(findings)

  return {
    runId,
    status: 'complete',
    findings,
    findingsByCategory: byCategory,
    metadata: {
      apiCallCount,
      cacheHitRate: 0,
      processingTimeMs: Date.now() - startTime,
      errors,
    },
  }
}

function groupByCategory(findings: AnalysisFinding[]): Record<InsightCategory, AnalysisFinding[]> {
  const categories: InsightCategory[] = ['diagnostic', 'medication', 'biomarker', 'pathway', 'research', 'trial', 'food', 'flare']
  const grouped = {} as Record<InsightCategory, AnalysisFinding[]>
  for (const cat of categories) {
    grouped[cat] = findings.filter(f => f.category === cat)
  }
  return grouped
}

function emptyResult(error: string): PipelineResult {
  return {
    runId: '',
    status: 'failed',
    findings: [],
    findingsByCategory: {
      diagnostic: [], medication: [], biomarker: [], pathway: [],
      research: [], trial: [], food: [], flare: [],
    },
    metadata: { apiCallCount: 0, cacheHitRate: 0, processingTimeMs: 0, errors: [error] },
  }
}
