/**
 * Meal Photo Recognition API
 * POST /api/food/identify
 *
 * Takes a photo of a meal and uses Claude Vision to identify foods
 * and estimate portions/calories. Then enriches with USDA nutrient data.
 *
 * Body: { image: base64, mediaType: string }
 * Returns: { foods: Array<{ name, estimatedCalories, estimatedServingSize, fdcId?, nutrients? }> }
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { searchFoods, getFoodNutrients } from '@/lib/api/usda-food'
import { guardUpload } from '@/lib/upload-guard'

export const maxDuration = 60

const MODEL = 'claude-sonnet-4-6'

type MediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

const IDENTIFICATION_PROMPT = `You are a nutrition analysis system. Look at this photo of food/meal.

Identify EVERY food item visible. For each item, estimate:
- name: Common food name (e.g., "grilled chicken breast", "brown rice", "steamed broccoli")
- estimatedGrams: Portion size in grams
- estimatedCalories: Calorie estimate for that portion
- mealType: "breakfast" | "lunch" | "dinner" | "snack" (best guess)

Be specific about preparation method (grilled vs fried matters for calories).
Include sauces, dressings, drinks if visible.

Respond with ONLY a JSON object:
{
  "foods": [
    { "name": "grilled chicken breast", "estimatedGrams": 170, "estimatedCalories": 280, "mealType": "dinner" },
    ...
  ],
  "mealDescription": "Brief overall description of the meal"
}

If this is not a food photo, respond with: { "foods": [], "mealDescription": "This does not appear to be food" }`

export async function POST(req: NextRequest) {
  const guard = guardUpload(req, { maxBytes: 15 * 1024 * 1024 })
  if (guard) return guard

  const body = await req.json()
  const { image, mediaType } = body as { image: string; mediaType: string }

  if (!image) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 })
  }

  const validTypes: MediaType[] = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  const mt = (validTypes.includes(mediaType as MediaType) ? mediaType : 'image/jpeg') as MediaType

  const client = new Anthropic()

  try {
    // Step 1: Claude Vision identifies foods
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mt,
              data: image.replace(/^data:image\/\w+;base64,/, ''),
            },
          },
          { type: 'text', text: IDENTIFICATION_PROMPT },
        ],
      }],
    })

    const responseText = response.content[0]?.type === 'text' ? response.content[0].text : '{}'
    const cleaned = responseText.replace(/^```json?\s*/m, '').replace(/\s*```$/m, '').trim()
    const result = JSON.parse(cleaned) as {
      foods: Array<{
        name: string
        estimatedGrams: number
        estimatedCalories: number
        mealType: string
      }>
      mealDescription: string
    }

    if (!result.foods || result.foods.length === 0) {
      return NextResponse.json({
        foods: [],
        mealDescription: result.mealDescription ?? 'No foods identified',
      })
    }

    // Step 2: Enrich with USDA nutrient data
    const enrichedFoods = await Promise.all(
      result.foods.map(async (food) => {
        try {
          const searchResults = await searchFoods(food.name, 1)
          if (searchResults.length > 0) {
            const nutrients = await getFoodNutrients(searchResults[0].fdcId)
            // Scale nutrients to estimated portion size
            const scale = (food.estimatedGrams && nutrients.servingSize)
              ? food.estimatedGrams / nutrients.servingSize
              : 1

            return {
              ...food,
              fdcId: searchResults[0].fdcId,
              usdaMatch: searchResults[0].description,
              nutrients: {
                calories: nutrients.calories ? Math.round(nutrients.calories * scale) : food.estimatedCalories,
                protein: nutrients.protein ? Math.round(nutrients.protein * scale * 10) / 10 : null,
                fat: nutrients.fat ? Math.round(nutrients.fat * scale * 10) / 10 : null,
                carbs: nutrients.carbs ? Math.round(nutrients.carbs * scale * 10) / 10 : null,
                fiber: nutrients.fiber ? Math.round(nutrients.fiber * scale * 10) / 10 : null,
                iron: nutrients.iron ? Math.round(nutrients.iron * scale * 10) / 10 : null,
                vitaminC: nutrients.vitaminC ? Math.round(nutrients.vitaminC * scale * 10) / 10 : null,
              },
            }
          }
        } catch {
          // USDA lookup failed -- return Claude estimate only
        }
        return { ...food, fdcId: null, usdaMatch: null, nutrients: null }
      }),
    )

    return NextResponse.json({
      foods: enrichedFoods,
      mealDescription: result.mealDescription,
      totalCalories: enrichedFoods.reduce((sum, f) => sum + (f.nutrients?.calories ?? f.estimatedCalories), 0),
    })
  } catch (e) {
    return NextResponse.json(
      { error: `Food identification failed: ${e instanceof Error ? e.message : 'Unknown'}` },
      { status: 500 },
    )
  }
}
