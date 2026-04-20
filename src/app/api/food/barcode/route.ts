/**
 * Barcode Lookup API
 * GET /api/food/barcode?code=5449000000996
 *
 * Looks up a product barcode in Open Food Facts database.
 * Returns product name, nutrients, NOVA score, allergens.
 */

import { NextRequest, NextResponse } from 'next/server'
import { lookupBarcode } from '@/lib/api/open-food-facts'
import { rateLimit, clientKey } from '@/lib/rate-limit'

const BARCODE_LIMITER = rateLimit({ windowMs: 60_000, max: 60 })

export async function GET(req: NextRequest) {
  if (!BARCODE_LIMITER.consume(clientKey(req))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const code = req.nextUrl.searchParams.get('code')

  if (!code || code.length < 6 || code.length > 32 || !/^\d+$/.test(code)) {
    return NextResponse.json({ error: 'Valid barcode required (6-32 digits)' }, { status: 400 })
  }

  const product = await lookupBarcode(code)

  if (!product) {
    return NextResponse.json({ error: 'Product not found', code }, { status: 404 })
  }

  return NextResponse.json(product)
}
