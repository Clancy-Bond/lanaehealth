import {
  estimateTokens,
  formatKBDocumentForContext,
} from '@/lib/intelligence/knowledge-base'
import type { KBDocument } from '@/lib/intelligence/types'

// ---------------------------------------------------------------------------
// Helper: build a KBDocument with sane defaults
// ---------------------------------------------------------------------------
function makeDoc(overrides: Partial<KBDocument> = {}): KBDocument {
  return {
    id: 'test-uuid',
    document_id: 'doc-001',
    document_type: 'micro_summary',
    title: 'GI Summary',
    content: 'Patient reports frequent nausea and bloating after meals.',
    version: 1,
    generated_at: '2026-04-10T00:00:00Z',
    generated_by: 'intelligence-engine',
    metadata: {},
    covers_date_start: null,
    covers_date_end: null,
    token_count: 12,
    is_stale: false,
    ...overrides,
  }
}

// ===========================================================================
// estimateTokens
// ===========================================================================
describe('estimateTokens', () => {
  it('returns a positive number for non-empty text', () => {
    const result = estimateTokens('Hello, this is a test string for token estimation.')
    expect(result).toBeGreaterThan(0)
  })

  it('returns less than text.length for typical text', () => {
    const text = 'Hello, this is a test string for token estimation.'
    const result = estimateTokens(text)
    expect(result).toBeLessThan(text.length)
  })

  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0)
  })
})

// ===========================================================================
// formatKBDocumentForContext
// ===========================================================================
describe('formatKBDocumentForContext', () => {
  it('formats a normal doc with title and content', () => {
    const doc = makeDoc()
    const result = formatKBDocumentForContext(doc)

    expect(result).toContain('GI Summary')
    expect(result).toContain('Patient reports frequent nausea')
  })

  it('adds STALE warning for stale documents', () => {
    const doc = makeDoc({ is_stale: true })
    const result = formatKBDocumentForContext(doc)

    expect(result).toContain('STALE')
  })

  it('does not add STALE warning for non-stale documents', () => {
    const doc = makeDoc({ is_stale: false })
    const result = formatKBDocumentForContext(doc)

    expect(result).not.toContain('STALE')
  })

  it('includes date range when both start and end are present', () => {
    const doc = makeDoc({
      covers_date_start: '2026-01-01',
      covers_date_end: '2026-03-31',
    })
    const result = formatKBDocumentForContext(doc)

    expect(result).toContain('2026-01-01')
    expect(result).toContain('2026-03-31')
  })

  it('does not include date range when dates are null', () => {
    const doc = makeDoc({
      covers_date_start: null,
      covers_date_end: null,
    })
    const result = formatKBDocumentForContext(doc)

    // Should not contain parenthesized date range
    expect(result).not.toMatch(/\(\d{4}-\d{2}-\d{2}/)
  })

  it('formats with markdown heading structure', () => {
    const doc = makeDoc()
    const result = formatKBDocumentForContext(doc)

    expect(result).toMatch(/^### /)
  })
})
