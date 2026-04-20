/**
 * Layer 2 Summary Engine - Test API Route
 *
 * GET ?topic=<topic>  - Returns cached or generated summary for that topic
 * GET ?query=<text>   - Returns which topics are relevant for that query
 * POST (no body)      - Regenerates ALL summaries (long-running)
 */

import { type SummaryTopic, SUMMARY_TOPICS } from '@/lib/context/summary-prompts'
import {
  getSummary,
  detectRelevantTopics,
  regenerateAllSummaries,
} from '@/lib/context/summary-engine'
import { requireAuth } from '@/lib/auth/require-user'

export const maxDuration = 300

export async function GET(request: Request) {
  const gate = requireAuth(request)
  if (!gate.ok) return gate.response

  try {
    const url = new URL(request.url)
    const topic = url.searchParams.get('topic')
    const query = url.searchParams.get('query')

    // Mode 1: Get summary for a specific topic
    if (topic) {
      const validTopics = Object.keys(SUMMARY_TOPICS)
      if (!validTopics.includes(topic)) {
        return Response.json(
          { error: `Invalid topic. Valid topics: ${validTopics.join(', ')}` },
          { status: 400 },
        )
      }

      const summary = await getSummary(topic as SummaryTopic)
      return Response.json({
        topic,
        name: SUMMARY_TOPICS[topic as SummaryTopic].name,
        summary,
        tokenEstimate: Math.round(summary.length / 4),
      })
    }

    // Mode 2: Detect relevant topics for a query
    if (query) {
      const relevantTopics = detectRelevantTopics(query)
      return Response.json({
        query,
        relevantTopics: relevantTopics.map((t) => ({
          key: t,
          name: SUMMARY_TOPICS[t].name,
          maxTokens: SUMMARY_TOPICS[t].maxTokens,
        })),
        totalTopics: relevantTopics.length,
      })
    }

    // No params: return available topics list
    const topicList = Object.entries(SUMMARY_TOPICS).map(([key, def]) => ({
      key,
      name: def.name,
      maxTokens: def.maxTokens,
      dataSources: def.dataSources,
      keywordCount: def.keywords.length,
    }))

    return Response.json({ topics: topicList })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const gate = requireAuth(request)
  if (!gate.ok) return gate.response

  try {
    const results = await regenerateAllSummaries()

    const summary: Record<string, { status: string; tokenEstimate: number }> = {}
    let successCount = 0
    let errorCount = 0

    for (const [topic, text] of Object.entries(results)) {
      if (text.startsWith('ERROR:')) {
        summary[topic] = { status: text, tokenEstimate: 0 }
        errorCount++
      } else {
        summary[topic] = {
          status: 'generated',
          tokenEstimate: Math.round(text.length / 4),
        }
        successCount++
      }
    }

    return Response.json({
      message: `Regenerated ${successCount} summaries, ${errorCount} errors`,
      results: summary,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ error: message }, { status: 500 })
  }
}
