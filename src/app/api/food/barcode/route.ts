/**
 * Barcode Lookup API
 * GET /api/food/barcode?code=5449000000996
 *
 * Looks up a product barcode in Open Food Facts database.
 * Returns product name, nutrients, NOVA score, allergens.
 */

import { NextRequest, NextResponse } from 'next/server'
import { lookupBarcode } from '@/lib/api/open-food-facts'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')

  if (!code || code.length < 6) {
    return NextResponse.json({ error: 'Valid barcode required (6+ digits)' }, { status: 400 })
  }

  const product = await lookupBarcode(code)

  if (!product) {
    return NextResponse.json({ error: 'Product not found', code }, { status: 404 })
  }

  return NextResponse.json(product)
}
