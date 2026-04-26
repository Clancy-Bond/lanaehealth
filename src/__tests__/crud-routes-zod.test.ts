// D-013b: every generic CRUD write route in Track D's scope must
// validate its request body with a zod schema before touching the
// database. Static-source scan: asserts each hardened route imports
// from `zod` and calls `.safeParse(` on the parsed body. We also
// sanity-check the zod-forms helper exports so a refactor that
// removes the shared preprocess wrappers trips CI immediately.

import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..')

const ZODDED_ROUTES: readonly string[] = [
  'app/api/calories/custom-foods/route.ts',
  'app/api/calories/favorites/toggle/route.ts',
  'app/api/calories/plan/route.ts',
  'app/api/calories/recipes/route.ts',
  'app/api/cycle/bbt/route.ts',
  'app/api/cycle/hormones/route.ts',
  'app/api/favorites/route.ts',
  'app/api/water/log/route.ts',
  'app/api/weight/log/route.ts',
]

const ZOD_IMPORT = /from ['"]zod['"]/
const SAFE_PARSE_CALL = /\.safeParse\(/

describe('D-013b - CRUD write routes validate body with zod', () => {
  for (const rel of ZODDED_ROUTES) {
    it(`${rel} imports zod and calls safeParse`, async () => {
      const body = await readFile(path.join(ROOT, rel), 'utf8')
      expect(ZOD_IMPORT.test(body), `${rel}: missing "import ... from 'zod'"`).toBe(true)
      expect(
        SAFE_PARSE_CALL.test(body),
        `${rel}: missing BodySchema.safeParse(...) gate`,
      ).toBe(true)
    })
  }

  it('zod-forms helper exports the shared preprocess wrappers', async () => {
    const body = await readFile(
      path.join(ROOT, 'lib/api/zod-forms.ts'),
      'utf8',
    )
    for (const name of [
      'zOptionalNumber',
      'zRequiredNumber',
      'zOptionalPositiveNumber',
      'zRequiredPositiveNumber',
      'zIsoDate',
    ]) {
      expect(body.includes(`export const ${name}`), `missing export ${name}`).toBe(true)
    }
  })
})
