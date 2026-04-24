import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { safeAll } from '@/lib/v2/safe-all'

describe('safeAll', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  describe('empty input', () => {
    it('returns an empty object when given no queries', async () => {
      const result = await safeAll({})
      expect(result).toEqual({})
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })
  })

  describe('all resolving', () => {
    it('populates each slot with the resolved value and a null error', async () => {
      const result = await safeAll({
        labs: Promise.resolve({ rows: [1, 2, 3] }),
        oura: Promise.resolve({ score: 88 }),
      })

      expect(result.labs.data).toEqual({ rows: [1, 2, 3] })
      expect(result.labs.error).toBeNull()
      expect(result.labs.label).toBe('labs')

      expect(result.oura.data).toEqual({ score: 88 })
      expect(result.oura.error).toBeNull()
      expect(result.oura.label).toBe('oura')

      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    it('handles primitive resolution values (string, number, null)', async () => {
      const result = await safeAll({
        s: Promise.resolve('hello'),
        n: Promise.resolve(42),
        nothing: Promise.resolve(null),
      })

      expect(result.s.data).toBe('hello')
      expect(result.n.data).toBe(42)
      expect(result.nothing.data).toBeNull()
      expect(result.s.error).toBeNull()
      expect(result.n.error).toBeNull()
      expect(result.nothing.error).toBeNull()
    })

    it('preserves insertion order of labels in the output', async () => {
      const result = await safeAll({
        z: Promise.resolve(1),
        a: Promise.resolve(2),
        m: Promise.resolve(3),
      })
      // Property order matches the input object's key order.
      expect(Object.keys(result)).toEqual(['z', 'a', 'm'])
    })
  })

  describe('one rejecting', () => {
    it('isolates the failing slot and lets others succeed', async () => {
      const boom = new Error('lab pipeline timed out')
      const result = await safeAll({
        labs: Promise.reject(boom),
        oura: Promise.resolve({ score: 91 }),
      })

      expect(result.labs.data).toBeNull()
      expect(result.labs.error).toBe(boom)
      expect(result.labs.label).toBe('labs')

      expect(result.oura.data).toEqual({ score: 91 })
      expect(result.oura.error).toBeNull()

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
      const call = consoleErrorSpy.mock.calls[0]
      expect(String(call[0])).toContain('"labs"')
    })

    it('still reports the slot label on a non-Error rejection', async () => {
      const result = await safeAll({
        oura: Promise.resolve({ ok: true }),
        cycle: Promise.reject('cycle string failure'),
      })
      expect(result.oura.error).toBeNull()
      expect(result.cycle.error).toBeInstanceOf(Error)
      expect(result.cycle.error?.message).toBe('cycle string failure')
      const call = consoleErrorSpy.mock.calls[0]
      expect(String(call[0])).toContain('"cycle"')
    })
  })

  describe('all rejecting', () => {
    it('returns null data + populated error for every slot', async () => {
      const e1 = new Error('one down')
      const e2 = new Error('two down')
      const result = await safeAll({
        labs: Promise.reject(e1),
        oura: Promise.reject(e2),
      })

      expect(result.labs.data).toBeNull()
      expect(result.labs.error).toBe(e1)
      expect(result.oura.data).toBeNull()
      expect(result.oura.error).toBe(e2)

      expect(consoleErrorSpy).toHaveBeenCalledTimes(2)
      const calls: string[] = consoleErrorSpy.mock.calls.map((c: unknown[]) => String(c[0]))
      expect(calls.some((c: string) => c.includes('"labs"'))).toBe(true)
      expect(calls.some((c: string) => c.includes('"oura"'))).toBe(true)
    })
  })

  describe('non-Error rejection coercion', () => {
    it('wraps a string rejection into an Error', async () => {
      const result = await safeAll({
        s: Promise.reject('hello-world failure'),
      })
      expect(result.s.error).toBeInstanceOf(Error)
      expect(result.s.error?.message).toBe('hello-world failure')
    })

    it('wraps a number rejection into an Error', async () => {
      const result = await safeAll({
        n: Promise.reject(404),
      })
      expect(result.n.error).toBeInstanceOf(Error)
      expect(result.n.error?.message).toBe('404')
    })

    it('wraps an undefined rejection into an Error with a sane fallback message', async () => {
      const result = await safeAll({
        u: Promise.reject(undefined),
      })
      expect(result.u.error).toBeInstanceOf(Error)
      expect(result.u.error?.message).toBe('Unknown error')
    })

    it('wraps a plain object rejection into an Error', async () => {
      const result = await safeAll({
        o: Promise.reject({ code: 500 }),
      })
      expect(result.o.error).toBeInstanceOf(Error)
      // String({code:500}) produces "[object Object]" which is what we expect.
      expect(result.o.error?.message).toBe('[object Object]')
    })
  })

  describe('console.error logging', () => {
    it('logs the slot label and the wrapped Error instance', async () => {
      const err = new Error('detailed reason')
      await safeAll({
        primary: Promise.reject(err),
      })
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
      const [msg, errArg] = consoleErrorSpy.mock.calls[0]
      expect(String(msg)).toContain('[safeAll]')
      expect(String(msg)).toContain('"primary"')
      expect(errArg).toBe(err)
    })

    it('does not log on success', async () => {
      await safeAll({ ok: Promise.resolve(true) })
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })
  })

  describe('type narrowing', () => {
    /*
     * Compile-time check: the result type is keyed off the input. If
     * this file type-checks under tsc --noEmit, the inference is
     * preserved. The runtime expects act as belt-and-braces.
     */
    it('preserves typed slot keys at runtime', async () => {
      const result = await safeAll({
        labs: Promise.resolve({ count: 3 } as { count: number }),
        oura: Promise.resolve(['a', 'b'] as readonly string[]),
      })
      // result.labs.data is typed as { count: number } | null
      // result.oura.data is typed as readonly string[] | null
      const labCount: number | null = result.labs.data?.count ?? null
      const firstOura: string | null = result.oura.data?.[0] ?? null
      expect(labCount).toBe(3)
      expect(firstOura).toBe('a')
      // Accessing a key not present in the input would be a type error.
      // @ts-expect-error - this slot was never declared.
      expect(result.bogus).toBeUndefined()
    })
  })

  describe('mixed timing', () => {
    it('waits for slow promises before returning', async () => {
      const slow = new Promise<string>((resolve) => setTimeout(() => resolve('late'), 5))
      const fast = Promise.resolve('early')
      const result = await safeAll({ slow, fast })
      expect(result.slow.data).toBe('late')
      expect(result.fast.data).toBe('early')
    })
  })
})
