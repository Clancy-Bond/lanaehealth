// Shared zod helpers for API routes that accept BOTH JSON and
// `application/x-www-form-urlencoded` / `multipart/form-data` bodies.
//
// Form posts deliver every field as a string, including numbers and
// empties. `z.coerce.number()` coerces '' to 0 which silently
// corrupts optional numeric fields. Routes on this project treat an
// empty field as "unset" (fall back to the prior value or skip the
// write). The preprocess wrappers below encode that rule once so
// each route schema stays short.

import { z } from 'zod'

const emptyToUndef = (v: unknown): unknown =>
  v === '' || v === null || v === undefined ? undefined : v

export const zOptionalNumber = z.preprocess(
  emptyToUndef,
  z.coerce.number().finite().optional(),
)

export const zRequiredNumber = z.preprocess(
  emptyToUndef,
  z.coerce.number().finite(),
)

export const zOptionalPositiveNumber = z.preprocess(
  emptyToUndef,
  z.coerce.number().positive().optional(),
)

export const zRequiredPositiveNumber = z.preprocess(
  emptyToUndef,
  z.coerce.number().positive(),
)

// YYYY-MM-DD, rejects '2026-13-40' shape mistakes at the edge.
export const zIsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')

// Accepts either an explicit boolean or the string 'true'/'false' that
// form posts produce.
export const zStringOrBool = z.preprocess(
  (v) => (v === 'true' ? true : v === 'false' ? false : v),
  z.boolean(),
)
