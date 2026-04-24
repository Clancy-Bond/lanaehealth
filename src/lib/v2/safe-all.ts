/*
 * safe-all
 *
 * Per-query error isolation for fan-out fetches. Replaces a raw
 * Promise.all where one rejection would tear down the whole render.
 *
 * Each entry returns { data, error, label } so callers can fall back
 * to an empty state per panel and surface a visible failure banner
 * for the user. For a medical surface, silent partial failure is the
 * wrong default. Callers should aggregate errors and tell the user.
 *
 * Usage:
 *   const r = await safeAll({
 *     labs:  sb.from('lab_results').select('*'),
 *     oura:  sb.from('oura_daily').select('*'),
 *   })
 *   const labs = (r.labs.data?.data as LabResult[]) ?? []
 *   const failed = Object.values(r).filter((x) => x.error)
 */

export interface SafeResult<T> {
  data: T | null
  error: Error | null
  label: string
}

export async function safeAll<T extends Record<string, Promise<unknown>>>(
  queries: T,
): Promise<{ [K in keyof T]: SafeResult<Awaited<T[K]>> }> {
  const labels = Object.keys(queries) as Array<keyof T>
  const settled = await Promise.allSettled(labels.map((label) => queries[label]))

  const out = {} as { [K in keyof T]: SafeResult<Awaited<T[K]>> }
  for (let i = 0; i < labels.length; i += 1) {
    const label = labels[i]
    const result = settled[i]
    const labelStr = String(label)

    if (result.status === 'fulfilled') {
      out[label] = {
        data: result.value as Awaited<T[typeof label]>,
        error: null,
        label: labelStr,
      }
    } else {
      const err =
        result.reason instanceof Error
          ? result.reason
          : new Error(String(result.reason ?? 'Unknown error'))
      // eslint-disable-next-line no-console
      console.error(`[safeAll] query "${labelStr}" failed:`, err)
      out[label] = {
        data: null,
        error: err,
        label: labelStr,
      }
    }
  }
  return out
}
