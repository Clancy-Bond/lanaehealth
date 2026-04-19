/**
 * safeFetch
 *
 * Thin wrapper around `fetch` for outbound calls to third-party APIs.
 *
 *  - Timeout via AbortController (default 30s).
 *  - Hard cap on the response body size (default 10 MB) to prevent a
 *    hostile / runaway upstream from consuming function memory.
 *  - Optional content-type allowlist so a site that suddenly returns
 *    HTML cannot poison a JSON pipeline.
 *  - Error messages never leak request bodies or Authorization
 *    headers.
 *
 * The result preserves `Response.json()` / `.text()` ergonomics so
 * callers only need to substitute the import.
 */

export interface SafeFetchOptions extends RequestInit {
  timeoutMs?: number
  maxBytes?: number
  contentTypes?: string[]
}

export class SafeFetchError extends Error {
  code: 'timeout' | 'too_large' | 'content_type' | 'network' | 'http'
  status?: number
  constructor(code: SafeFetchError['code'], message: string, status?: number) {
    super(message)
    this.name = 'SafeFetchError'
    this.code = code
    this.status = status
  }
}

export async function safeFetch(url: string, opts: SafeFetchOptions = {}): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? 30_000
  const maxBytes = opts.maxBytes ?? 10 * 1024 * 1024

  const controller = new AbortController()
  const signal = opts.signal
    ? AbortSignal.any([opts.signal, controller.signal])
    : controller.signal

  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response: Response
  try {
    response = await fetch(url, { ...opts, signal })
  } catch (err) {
    clearTimeout(timer)
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new SafeFetchError('timeout', `safeFetch timed out after ${timeoutMs}ms`)
    }
    throw new SafeFetchError('network', err instanceof Error ? err.message : 'network error')
  }

  clearTimeout(timer)

  // Content-Type allowlist if the caller asked for one.
  if (opts.contentTypes && opts.contentTypes.length > 0) {
    const ct = (response.headers.get('content-type') ?? '').toLowerCase()
    const ok = opts.contentTypes.some((t) => ct.includes(t.toLowerCase()))
    if (!ok) {
      throw new SafeFetchError(
        'content_type',
        `unexpected content-type from upstream (got ${ct || 'none'})`,
        response.status,
      )
    }
  }

  // Enforce the body-size cap. Prefer the declared content-length where
  // upstream is honest; always follow up by reading via a limited reader.
  const declared = Number(response.headers.get('content-length') ?? '0')
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new SafeFetchError(
      'too_large',
      `upstream content-length ${declared} exceeds cap ${maxBytes}`,
      response.status,
    )
  }

  if (!response.body) {
    return response
  }

  // Read the body through a size-capped accumulator, then hand the caller
  // a fresh Response that carries the buffered bytes.
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new SafeFetchError(
        'too_large',
        `upstream body exceeded cap ${maxBytes}`,
        response.status,
      )
    }
    chunks.push(value)
  }

  const buffer = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    buffer.set(chunk, offset)
    offset += chunk.byteLength
  }

  return new Response(buffer, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}
