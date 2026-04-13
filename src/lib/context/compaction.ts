/**
 * Conversation Compaction Engine
 *
 * When chat history grows long, this module compresses it using
 * a structured 9-section template. The goal is to preserve all
 * medically important details while dramatically reducing token count.
 *
 * Key invariants:
 *   - User messages in Section 6 are ALWAYS preserved verbatim
 *   - Exact lab values, dates, and medical findings are never dropped
 *   - Correlation findings with confidence levels are preserved
 *   - The most recent 3-5 exchanges are kept intact
 *   - Maximum 3,000 tokens for the compacted summary
 */

import Anthropic from '@anthropic-ai/sdk'
import type { CompactedHistory } from '@/lib/types'

// ── Compaction Thresholds ──────────────────────────────────────────

interface CompactionTier {
  /** Fraction of windowSize at which this tier triggers */
  threshold: number
  /** Name for logging/debugging */
  name: 'micro' | 'auto' | 'full'
}

const TIERS: CompactionTier[] = [
  { threshold: 0.60, name: 'micro' },
  { threshold: 0.835, name: 'auto' },
  { threshold: 0.95, name: 'full' },
]

const DEFAULT_WINDOW_SIZE = 200_000

// ── Message Interface ──────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

// ── Token Estimation ───────────────────────────────────────────────

/**
 * Estimates the token count for an array of chat messages.
 * Uses the approximation: (content.length / 4) + 4 per message
 * (the +4 accounts for role tokens and message framing).
 */
export function estimateTokens(messages: ChatMessage[]): number {
  let total = 0
  for (const msg of messages) {
    total += Math.round(msg.content.length / 4) + 4
  }
  return total
}

// ── Compaction Check ───────────────────────────────────────────────

/**
 * Determines whether compaction is needed and which tier to use.
 *
 * Tiers:
 *   60.0% of window = micro (trim old tool outputs)
 *   83.5% of window = auto  (9-section template)
 *   95.0% of window = full  (aggressive compression)
 */
export function shouldCompact(
  tokenCount: number,
  windowSize: number = DEFAULT_WINDOW_SIZE,
): { needed: boolean; tier: 'micro' | 'auto' | 'full' | null } {
  const ratio = tokenCount / windowSize

  // Check from highest tier downward
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (ratio >= TIERS[i].threshold) {
      return { needed: true, tier: TIERS[i].name }
    }
  }

  return { needed: false, tier: null }
}

// ── 9-Section Compaction Prompt ────────────────────────────────────

const COMPACTION_SYSTEM_PROMPT = `You are a medical conversation compactor for a health tracking application. Your job is to compress a conversation into a structured 9-section summary while preserving ALL medically relevant information.

CRITICAL RULES:
- NEVER drop exact lab values (e.g., "Ferritin 12 ng/mL on 2024-03-15")
- NEVER drop dates associated with medical events or findings
- NEVER paraphrase user messages in Section 6 - copy them EXACTLY as written
- NEVER drop correlation findings - preserve the confidence level and sample size
- Preserve all medication names, dosages, and timing
- Keep the most recent 3-5 user/assistant exchanges intact in context
- Maximum 3,000 tokens for the entire compacted output`

function buildCompactionUserPrompt(messages: ChatMessage[]): string {
  const conversationText = messages.map((m) => {
    const prefix = m.role === 'user' ? 'USER' : m.role === 'assistant' ? 'ASSISTANT' : 'SYSTEM'
    return `[${prefix}]: ${m.content}`
  }).join('\n\n')

  return `Compress the following conversation into the 9-section template below. Output ONLY the sections, nothing else.

CONVERSATION:
${conversationText}

OUTPUT TEMPLATE (fill in each section):

## 1. Primary Request
What did the user originally ask for?

## 2. Key Concepts Discovered
List all findings, data points, and decisions made. Include exact values and dates.

## 3. Files and Data Referenced
Which data sources, date ranges, lab tests, or datasets were consulted?

## 4. Errors Encountered and Fixes
What was ruled out? What results came back normal? What approaches did not work?

## 5. Problem-Solving Approaches Tried
What investigations were performed? What analyses were run?

## 6. User Messages (VERBATIM)
Copy ALL user messages exactly as written, each prefixed with [User]:

## 7. Pending Tasks
What still needs investigation or follow-up?

## 8. Current Work State
What do we know so far? What is the current status?

## 9. Next Steps
What is the immediate next action?`
}

// ── Section Parser ─────────────────────────────────────────────────

function parseCompactedResponse(text: string): CompactedHistory {
  const sections: Record<string, string> = {}

  // Split by section headers: "## N. Title"
  // Use split + iterate to avoid needing the 's' regex flag
  const lines = text.split('\n')
  let currentSection: string | null = null
  let currentLines: string[] = []

  for (const line of lines) {
    const headerMatch = line.match(/^## (\d+)\.\s+/)
    if (headerMatch) {
      // Save previous section
      if (currentSection !== null) {
        sections[currentSection] = currentLines.join('\n').trim()
      }
      currentSection = headerMatch[1]
      currentLines = []
    } else if (currentSection !== null) {
      currentLines.push(line)
    }
  }
  // Save last section
  if (currentSection !== null) {
    sections[currentSection] = currentLines.join('\n').trim()
  }

  // Extract verbatim user messages from Section 6
  const section6 = sections['6'] ?? ''
  const userMessages: string[] = []
  const s6Lines = section6.split('\n')
  for (const s6Line of s6Lines) {
    const umMatch = s6Line.match(/^\[User\]:\s*(.+)/)
    if (umMatch) {
      userMessages.push(umMatch[1].trim())
    }
  }

  return {
    primary_request: sections['1'] ?? '',
    key_concepts: sections['2'] ?? '',
    files_and_data: sections['3'] ?? '',
    errors_and_fixes: sections['4'] ?? '',
    approaches_tried: sections['5'] ?? '',
    user_messages_verbatim: userMessages.length > 0 ? userMessages : [section6],
    pending_tasks: sections['7'] ?? '',
    current_state: sections['8'] ?? '',
    next_steps: sections['9'] ?? '',
  }
}

// ── Main Compaction Function ───────────────────────────────────────

/**
 * Compacts a conversation history using Claude Sonnet and the
 * 9-section structured template.
 *
 * Returns a CompactedHistory object with each section parsed out,
 * suitable for re-injection as context in future conversations.
 */
export async function compactConversation(
  messages: ChatMessage[],
): Promise<CompactedHistory> {
  if (messages.length === 0) {
    return {
      primary_request: '',
      key_concepts: '',
      files_and_data: '',
      errors_and_fixes: '',
      approaches_tried: '',
      user_messages_verbatim: [],
      pending_tasks: '',
      current_state: '',
      next_steps: '',
    }
  }

  const client = new Anthropic()

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    system: COMPACTION_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: buildCompactionUserPrompt(messages),
      },
    ],
  })

  // Extract text from response
  const responseText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')

  return parseCompactedResponse(responseText)
}
