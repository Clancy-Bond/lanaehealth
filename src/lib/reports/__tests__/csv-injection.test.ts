/**
 * CSV formula-injection regression tests.
 *
 * Excel / Sheets / Numbers interpret any cell that begins with `=`, `+`,
 * `-`, `@`, tab, or CR as a formula. This is a known CSV-export
 * exfiltration pattern: a symptom note like "=HYPERLINK(...)" would fire
 * on open. Both export paths now prefix offending cells with `'`.
 */

import { describe, it, expect } from 'vitest'
import { rowsToCsv } from '@/app/api/export/full/route'

describe('rowsToCsv (Track B formula-injection fix)', () => {
  const dangerousLeaders = ['=', '+', '-', '@', '\t', '\r']

  for (const ch of dangerousLeaders) {
    it(`prefixes an apostrophe when a cell begins with ${JSON.stringify(ch)}`, () => {
      const csv = rowsToCsv([{ note: `${ch}HYPERLINK("http://evil")` }])
      const dataRow = csv.split('\r\n')[1]
      // Because cells that start with ' get wrapped in quotes by the
      // comma/newline rule only when needed, just check the leading char
      // is the apostrophe.
      expect(dataRow.startsWith("'") || dataRow.startsWith('"\'')).toBe(true)
      // And the raw formula leader is no longer the first output byte.
      expect(dataRow.startsWith(ch)).toBe(false)
    })
  }

  it('leaves normal text alone', () => {
    const csv = rowsToCsv([{ note: 'Pain 7/10' }])
    const dataRow = csv.split('\r\n')[1]
    expect(dataRow).toBe('Pain 7/10')
  })

  it('combines prefixing with quoting when the cell also contains a comma', () => {
    const csv = rowsToCsv([{ note: '=SUM(a,b)' }])
    const dataRow = csv.split('\r\n')[1]
    expect(dataRow).toContain("'=SUM")
    expect(dataRow.startsWith('"')).toBe(true)
  })
})
