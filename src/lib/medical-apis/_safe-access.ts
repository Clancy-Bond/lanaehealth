/**
 * Safe-access helpers for untyped third-party JSON responses.
 *
 * The medical-apis modules call many external services (FHIR, NCBI, OpenFDA,
 * UniProt, OLS4, etc) that return loosely typed JSON. Casting each shape to
 * `any` made TSC pliable but lost all guard rails. These helpers replace that
 * pattern with `unknown` plus minimal type guards that still let callers chain
 * property reads naturally while keeping every value `unknown` until proved
 * otherwise.
 *
 * Behavior is intentionally identical to the prior `any` access pattern: a
 * missing or wrong-shape field returns undefined / 0 / "" rather than throw.
 */

/** A loose record where every value is unknown until narrowed. */
export type LooseRecord = Record<string, unknown>

/** Narrowed type guard for plain JSON objects. */
export function isObject(value: unknown): value is LooseRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Read a property from an unknown value as `unknown`. */
export function prop(value: unknown, key: string): unknown {
  return isObject(value) ? value[key] : undefined
}

/** Read a string property from an unknown value, or an empty string. */
export function str(value: unknown, key: string): string {
  const v = prop(value, key)
  return typeof v === 'string' ? v : ''
}

/** Read a number property from an unknown value, or 0. */
export function num(value: unknown, key: string): number {
  const v = prop(value, key)
  return typeof v === 'number' ? v : 0
}

/** Read an array property from an unknown value, or an empty array. */
export function arr(value: unknown, key: string): unknown[] {
  const v = prop(value, key)
  return Array.isArray(v) ? v : []
}

/** Cast to array if possible, else empty array. */
export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}
