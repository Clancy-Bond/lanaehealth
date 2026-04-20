/**
 * Food Search API
 * GET /api/food/search?q=chicken&limit=10
 *
 * Searches USDA FoodData Central for foods.
 * Returns food name, FDC ID, data type, and brand name.
 */

import { NextRequest, NextResponse } from 'next/server'
import { searchFoods } from '@/lib/api/usda-food'
import { jsonError } from '@/lib/api/json-error'

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q')
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '10', 10)

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] })
  }

  try {
    const results = await searchFoods(query, Math.min(limit, 25))
    return NextResponse.json({ results })
  } catch (e) {
    return jsonError(500, 'food_search_failed', e)
  }
}
