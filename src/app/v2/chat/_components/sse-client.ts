/*
 * sse-client
 *
 * Minimal SSE consumer for /api/chat. We use fetch + ReadableStream
 * rather than EventSource because:
 *
 *   - EventSource cannot send a body or POST.
 *   - We need to forward the auth cookie automatically (fetch does
 *     this without configuration when same-origin).
 *   - We need to abort the connection on unmount or send-cancel.
 *
 * Wire format matches the route handler:
 *
 *   event: NAME\n
 *   data: <single-line JSON>\n
 *   \n
 *
 * `data` is always a single line because the server uses
 * JSON.stringify; we never need multi-line `data:` frame handling.
 */

export type ChatStreamEvent =
  | { type: 'context'; citations: ChatCitationData[]; tokenEstimate: number }
  | { type: 'tool'; name: string }
  | { type: 'token'; delta: string }
  | { type: 'done'; full_response: string; toolsUsed: string[]; citations: ChatCitationData[] }
  | { type: 'error'; message: string }

export interface ChatCitationData {
  kind: 'retrieval' | 'summary'
  label: string
  contentType?: string
  date?: string
  href?: string
}

export interface StreamChatOptions {
  message: string
  signal?: AbortSignal
  onEvent: (event: ChatStreamEvent) => void
}

/**
 * Opens an SSE chat turn against /api/chat and dispatches events to
 * `onEvent`. Resolves when the stream closes (normally after a
 * `done` event). Throws on network or HTTP error so the caller can
 * surface the right bubble.
 */
export async function streamChat({ message, signal, onEvent }: StreamChatOptions): Promise<void> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({ message }),
    signal,
  })

  if (!res.ok) {
    // Surface the HTTP status so the client can branch on auth/server.
    const err = new Error(`chat http ${res.status}`) as Error & { status?: number }
    err.status = res.status
    throw err
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('chat stream missing body')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // Frames are separated by blank lines. Pull off each complete
    // frame and leave the partial trailer for the next iteration.
    let split: number
    while ((split = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, split)
      buffer = buffer.slice(split + 2)
      const parsed = parseFrame(frame)
      if (parsed) onEvent(parsed)
    }
  }

  // Drain anything left in the buffer (rare; final frame should
  // already have ended with \n\n).
  if (buffer.trim().length > 0) {
    const parsed = parseFrame(buffer)
    if (parsed) onEvent(parsed)
  }
}

function parseFrame(frame: string): ChatStreamEvent | null {
  let event = ''
  let data = ''
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) data += line.slice(5).trim()
  }
  if (!event || !data) return null
  try {
    const payload = JSON.parse(data)
    switch (event) {
      case 'context':
        return { type: 'context', citations: payload.citations ?? [], tokenEstimate: payload.tokenEstimate ?? 0 }
      case 'tool':
        return { type: 'tool', name: payload.name }
      case 'token':
        // token payload is a JSON string; JSON.parse already turned
        // it into a plain string for us.
        return { type: 'token', delta: typeof payload === 'string' ? payload : String(payload) }
      case 'done':
        return {
          type: 'done',
          full_response: payload.full_response ?? '',
          toolsUsed: payload.toolsUsed ?? [],
          citations: payload.citations ?? [],
        }
      case 'error':
        return { type: 'error', message: payload.message ?? 'unknown error' }
      default:
        return null
    }
  } catch {
    return null
  }
}
