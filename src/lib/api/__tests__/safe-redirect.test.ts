import { describe, it, expect } from 'vitest'
import { safeReturnTo } from '../safe-redirect'

const BASE = 'https://lanaehealth.test'

describe('safeReturnTo', () => {
  it('admits a same-origin absolute path', () => {
    expect(safeReturnTo('/log?date=2026-04-19', '/', BASE).toString()).toBe(
      `${BASE}/log?date=2026-04-19`,
    )
  })

  it('uses the fallback when input is missing or empty', () => {
    expect(safeReturnTo(undefined, '/', BASE).toString()).toBe(`${BASE}/`)
    expect(safeReturnTo('', '/', BASE).toString()).toBe(`${BASE}/`)
    expect(safeReturnTo(null, '/', BASE).toString()).toBe(`${BASE}/`)
  })

  it('rejects an absolute https URL (open-redirect prevention)', () => {
    expect(safeReturnTo('https://evil.com/grab', '/', BASE).toString()).toBe(
      `${BASE}/`,
    )
  })

  it('rejects a protocol-relative URL (//evil.com)', () => {
    expect(safeReturnTo('//evil.com/grab', '/', BASE).toString()).toBe(
      `${BASE}/`,
    )
  })

  it('rejects backslash-prefixed inputs (/\\evil.com)', () => {
    expect(safeReturnTo('/\\evil.com', '/', BASE).toString()).toBe(
      `${BASE}/`,
    )
  })

  it('rejects bare paths without a leading slash', () => {
    expect(safeReturnTo('log', '/', BASE).toString()).toBe(`${BASE}/`)
  })

  it('rejects javascript: and data: schemes', () => {
    expect(safeReturnTo('javascript:alert(1)', '/', BASE).toString()).toBe(
      `${BASE}/`,
    )
    expect(safeReturnTo('data:text/html,x', '/', BASE).toString()).toBe(
      `${BASE}/`,
    )
  })

  it('rejects non-string types', () => {
    expect(safeReturnTo(42, '/', BASE).toString()).toBe(`${BASE}/`)
    expect(safeReturnTo({ url: '/x' }, '/', BASE).toString()).toBe(`${BASE}/`)
  })
})
