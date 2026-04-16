import { shouldTriggerAnalysis } from '@/lib/intelligence/auto-trigger'

// ---------------------------------------------------------------------------
// shouldTriggerAnalysis -- pure function tests (no HTTP, no cooldown)
//
// NOTE: We do NOT test the cooldown (global mutable state that is hard to
// reset between tests) or triggerAnalysis (makes HTTP calls).
// ---------------------------------------------------------------------------

describe('shouldTriggerAnalysis', () => {
  it('returns full for lab_results with count > 0', () => {
    const result = shouldTriggerAnalysis('lab_results', 5)
    expect(result).not.toBeNull()
    expect(result!.mode).toBe('full')
    expect(result!.reason).toContain('5')
    expect(result!.reason).toContain('lab results')
  })

  it('returns full for imaging_studies with count > 0', () => {
    const result = shouldTriggerAnalysis('imaging_studies', 2)
    expect(result).not.toBeNull()
    expect(result!.mode).toBe('full')
    expect(result!.reason).toContain('2')
    expect(result!.reason).toContain('imaging')
  })

  it('returns standard for oura_daily with count >= 7', () => {
    const result = shouldTriggerAnalysis('oura_daily', 7)
    expect(result).not.toBeNull()
    expect(result!.mode).toBe('standard')
    expect(result!.reason).toContain('7')
    expect(result!.reason).toContain('Oura')
  })

  it('returns null for oura_daily with count < 7', () => {
    const result = shouldTriggerAnalysis('oura_daily', 3)
    expect(result).toBeNull()
  })

  it('returns incremental for daily_logs with count > 0', () => {
    const result = shouldTriggerAnalysis('daily_logs', 1)
    expect(result).not.toBeNull()
    expect(result!.mode).toBe('incremental')
    expect(result!.reason).toContain('daily log')
  })

  it('returns full for import_myah with count > 0', () => {
    const result = shouldTriggerAnalysis('import_myah', 38)
    expect(result).not.toBeNull()
    expect(result!.mode).toBe('full')
    expect(result!.reason).toContain('myAH')
    expect(result!.reason).toContain('38')
  })

  it('returns null for unknown data source', () => {
    const result = shouldTriggerAnalysis('unknown_table', 100)
    expect(result).toBeNull()
  })
})
