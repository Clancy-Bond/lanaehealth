/**
 * RSC serialization guard
 *
 * Background: PR #87 fixed a production outage where /v2/cycle, /v2/sleep,
 * /v2/log, and /v2/calories rendered the chrome but never resolved past the
 * loading skeleton. Root cause: a Server Component was passing inline arrow
 * functions (an inline `format: (v) => string` field on objects inside a
 * `fields` array) to the CorrectionsPanel client component. React cannot
 * serialize functions across the server-to-client boundary unless they are
 * marked `'use server'`, so the framework throws on every render and the
 * Suspense boundary never settles.
 *
 * This guard catches the same class of bug at runtime in development, well
 * before it reaches production. It walks the props passed into a client
 * component and warns on any value that React would refuse to serialize:
 *   - functions (the actual PR #87 trigger)
 *   - class instances of Map / Set / WeakMap / WeakSet
 *   - symbols
 *
 * Date instances are intentionally not flagged: React serializes them as
 * ISO strings on the wire, so they round-trip safely. Same for plain
 * objects, arrays, primitives, and JSX (React elements are serialized by
 * the framework itself).
 *
 * The walker recurses into plain objects and arrays because the bug we
 * just shipped lived inside an array element, not at the top level. Limit
 * recursion depth to keep the dev render fast and avoid pathological
 * nesting.
 *
 * Usage (in any client component that takes user-supplied props):
 *
 *   'use client'
 *   import { assertSerializable } from '@/v2/lib/rsc-serialization-guard'
 *
 *   export default function MyClient(props: MyClientProps) {
 *     assertSerializable(props as Record<string, unknown>, 'MyClient')
 *     ...
 *   }
 *
 * In production builds the function is a no-op so it adds zero overhead.
 */

const MAX_DEPTH = 4

function describe(value: unknown): string {
  if (typeof value === 'function') return 'function'
  if (typeof value === 'symbol') return 'symbol'
  if (value instanceof Map) return 'Map'
  if (value instanceof Set) return 'Set'
  if (value instanceof WeakMap) return 'WeakMap'
  if (value instanceof WeakSet) return 'WeakSet'
  return typeof value
}

function isUnserializable(value: unknown): boolean {
  if (typeof value === 'function') return true
  if (typeof value === 'symbol') return true
  if (value instanceof Map) return true
  if (value instanceof Set) return true
  if (value instanceof WeakMap) return true
  if (value instanceof WeakSet) return true
  return false
}

function walk(
  value: unknown,
  path: string,
  depth: number,
  warnings: Array<{ path: string; kind: string }>,
): void {
  if (depth > MAX_DEPTH) return
  if (value == null) return
  if (isUnserializable(value)) {
    warnings.push({ path, kind: describe(value) })
    return
  }
  // Recurse arrays and plain objects only. Skip React elements: any object
  // with $$typeof is a React element which the framework owns.
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      walk(value[i], `${path}[${i}]`, depth + 1, warnings)
    }
    return
  }
  if (typeof value === 'object') {
    // React element marker
    if ('$$typeof' in (value as Record<string, unknown>)) return
    // Date round-trips safely; do not recurse.
    if (value instanceof Date) return
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      walk(v, `${path}.${k}`, depth + 1, warnings)
    }
  }
}

/**
 * Assert that all props passed to a client component are serializable
 * across the React Server Component boundary. No-op in production.
 *
 * Logs a single grouped console.warn per render that finds violations,
 * listing each offending prop path and its type. This is a hint to the
 * developer to convert the value to a serializable equivalent (e.g.
 * pre-compute a string on the server, dispatch by enum tag, etc.).
 */
export function assertSerializable(
  props: Record<string, unknown>,
  componentName: string,
): void {
  if (process.env.NODE_ENV !== 'development') return
  if (!props) return
  const warnings: Array<{ path: string; kind: string }> = []
  for (const [k, v] of Object.entries(props)) {
    walk(v, k, 0, warnings)
  }
  if (warnings.length === 0) return
  // eslint-disable-next-line no-console
  console.warn(
    `[RSC-Guard] ${componentName} received ${warnings.length} unserializable prop value${warnings.length === 1 ? '' : 's'}.`,
    `These will throw "Functions cannot be passed across RSC boundary" in production if the immediate parent is a Server Component.`,
    `\n  ` + warnings.map((w) => `${w.path}: ${w.kind}`).join('\n  '),
  )
}
