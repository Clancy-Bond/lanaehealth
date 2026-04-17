/**
 * Anthropic prompt-cache metrics logger.
 *
 * Every Claude API response carries usage counters. When `cache_control`
 * breakpoints are configured on the system prompt, two extra counters are
 * populated:
 *
 *   - cache_creation_input_tokens: tokens written into the cache on this call
 *   - cache_read_input_tokens:     tokens served from the cache (10% cost)
 *
 * `logCacheMetrics` emits a single structured log line per call so we can
 * confirm cache hits in production logs without reshaping the SDK response.
 *
 * The helper is permissive: it accepts any object with a `usage` field and
 * silently no-ops if the field is missing, so callers can wrap existing
 * responses without type churn.
 */

export interface AnthropicLikeUsage {
  input_tokens?: number | null
  output_tokens?: number | null
  cache_creation_input_tokens?: number | null
  cache_read_input_tokens?: number | null
}

export interface AnthropicLikeResponse {
  usage?: AnthropicLikeUsage
}

/**
 * Log cache-hit metrics for an Anthropic response.
 *
 * Output shape (single console.log line, bracket-tagged for easy grep):
 *   [cache_metrics label=chat input=123 output=45 cache_read=900 cache_creation=0]
 *
 * @param response   The object returned by `client.messages.create(...)`
 * @param label      Short tag (e.g. 'chat', 'analyze', 'narrator') so
 *                   multiple call sites can be distinguished in logs.
 */
export function logCacheMetrics(
  response: AnthropicLikeResponse | null | undefined,
  label: string = 'unknown',
): void {
  if (!response || !response.usage) return

  const usage = response.usage
  const parts: string[] = [`label=${label}`]

  if (typeof usage.input_tokens === 'number') {
    parts.push(`input=${usage.input_tokens}`)
  }
  if (typeof usage.output_tokens === 'number') {
    parts.push(`output=${usage.output_tokens}`)
  }
  if (typeof usage.cache_read_input_tokens === 'number') {
    parts.push(`cache_read_input_tokens=${usage.cache_read_input_tokens}`)
  }
  if (typeof usage.cache_creation_input_tokens === 'number') {
    parts.push(`cache_creation_input_tokens=${usage.cache_creation_input_tokens}`)
  }

  console.log(`[cache_metrics ${parts.join(' ')}]`)
}

/**
 * Lightweight discriminator: did this response read from the cache?
 * Returns false when the counter is missing or zero.
 */
export function hadCacheHit(response: AnthropicLikeResponse | null | undefined): boolean {
  const n = response?.usage?.cache_read_input_tokens
  return typeof n === 'number' && n > 0
}
