/**
 * Session Handoff System
 *
 * When a conversation ends, this module generates a structured handoff
 * summary that captures what happened, what was learned, what remains,
 * and what the next session needs to know. The handoff is stored in
 * the session_handoffs table and loaded into the next session's context.
 *
 * Design principle: "The LAST action of a session should be writing
 * a structured handoff that becomes a memory file for the next session."
 */

import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase'
import type { SessionHandoff } from '@/lib/types'
import type { ChatMessage } from './compaction'

// ── Types ─────────────────────────────────────────────────────────

type SessionType = 'chat' | 'analysis' | 'doctor_prep' | 'daily_review'

// ── Handoff Generation Prompt ─────────────────────────────────────

const HANDOFF_SYSTEM_PROMPT = `You are a medical session summarizer for a health tracking application. Your job is to produce a structured handoff from a conversation so the next session has full continuity.

Write in concise, factual prose. Preserve all specific medical details: exact lab values, dates, medication names and dosages, symptom descriptions, and correlation findings with confidence levels. Do not editorialize or add advice.

Output EXACTLY four sections with these headers (no other text):

## ACCOMPLISHED
What was done in this session.

## DISCOVERED
New information learned -- symptoms, patterns, lab interpretations, correlations, or user-reported details.

## LEFT UNDONE
Items that were started but not completed, or explicitly deferred.

## NEXT SESSION NEEDS
What the next conversation needs to know to pick up seamlessly. Include any pending questions, upcoming appointments, or data the user said they would provide.`

// ── Section Parser ────────────────────────────────────────────────

interface HandoffSections {
  accomplished: string
  discovered: string
  leftUndone: string
  nextSessionNeeds: string
}

function parseHandoffSections(text: string): HandoffSections {
  const result: HandoffSections = {
    accomplished: '',
    discovered: '',
    leftUndone: '',
    nextSessionNeeds: '',
  }

  const sectionMap: Record<string, keyof HandoffSections> = {
    'ACCOMPLISHED': 'accomplished',
    'DISCOVERED': 'discovered',
    'LEFT UNDONE': 'leftUndone',
    'NEXT SESSION NEEDS': 'nextSessionNeeds',
  }

  const lines = text.split('\n')
  let currentKey: keyof HandoffSections | null = null
  let currentLines: string[] = []

  for (const line of lines) {
    // Match "## SECTION_NAME" headers
    const headerMatch = line.match(/^##\s+(.+)/)
    if (headerMatch) {
      const headerText = headerMatch[1].trim()
      const mappedKey = sectionMap[headerText]
      if (mappedKey) {
        // Save previous section
        if (currentKey !== null) {
          result[currentKey] = currentLines.join('\n').trim()
        }
        currentKey = mappedKey
        currentLines = []
        continue
      }
    }

    if (currentKey !== null) {
      currentLines.push(line)
    }
  }

  // Save last section
  if (currentKey !== null) {
    result[currentKey] = currentLines.join('\n').trim()
  }

  return result
}

// ── Write Handoff ─────────────────────────────────────────────────

/**
 * Generates a structured session handoff from conversation messages
 * and stores it in the session_handoffs table.
 *
 * Takes the last 20 messages for the Claude summary, and extracts
 * all user messages verbatim from the full array.
 *
 * @param sessionType - The type of session being closed
 * @param messages - Full conversation messages array
 * @returns Confirmation string with the handoff ID
 */
export async function writeHandoff(
  sessionType: SessionType,
  messages: ChatMessage[],
): Promise<string> {
  if (messages.length === 0) {
    return 'No messages to summarize -- handoff skipped.'
  }

  // Take last 20 messages for the summary
  const recentMessages = messages.slice(-20)

  const conversationText = recentMessages
    .map((m) => {
      const prefix = m.role === 'user' ? 'USER' : m.role === 'assistant' ? 'ASSISTANT' : 'SYSTEM'
      return `[${prefix}]: ${m.content}`
    })
    .join('\n\n')

  // Generate structured handoff via Claude
  const client = new Anthropic()

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: HANDOFF_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Generate a session handoff for this ${sessionType} conversation:\n\n${conversationText}`,
      },
    ],
  })

  const responseText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')

  // Parse the four sections
  const sections = parseHandoffSections(responseText)

  // Extract all user messages verbatim from full conversation
  const userMessagesVerbatim = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)

  // Insert into Supabase
  const sb = createServiceClient()

  const { data, error } = await sb
    .from('session_handoffs')
    .insert({
      session_type: sessionType,
      what_accomplished: sections.accomplished,
      what_discovered: sections.discovered,
      what_left_undone: sections.leftUndone,
      next_session_needs: sections.nextSessionNeeds,
      user_messages_verbatim: userMessagesVerbatim,
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`Failed to store session handoff: ${error.message}`)
  }

  return `Session handoff saved (${data.id}). Type: ${sessionType}, sections: 4, user messages preserved: ${userMessagesVerbatim.length}.`
}

// ── Get Latest Handoff ────────────────────────────────────────────

/**
 * Retrieves the most recent session handoff for loading
 * into the next conversation's context.
 *
 * @returns The most recent SessionHandoff row, or null if none exist
 */
export async function getLatestHandoff(): Promise<SessionHandoff | null> {
  const sb = createServiceClient()

  const { data, error } = await sb
    .from('session_handoffs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    // .single() returns an error when no rows match -- treat as null
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Failed to fetch latest handoff: ${error.message}`)
  }

  return data as SessionHandoff
}
