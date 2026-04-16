/**
 * Lab Photo Scan API Route
 *
 * POST /api/labs/scan - Accept a photo of lab results and extract data via Claude Vision
 * Body: { image: string (base64), mediaType: string }
 *
 * Returns parsed lab results for user review before import.
 */

import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

const MODEL = 'claude-sonnet-4-6'
const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB

type MediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

const VALID_MEDIA_TYPES: MediaType[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]

const EXTRACTION_PROMPT = `You are a medical lab results OCR system. Analyze this photo of a lab results document.

Extract EVERY test result visible in the image. For each test, provide:
- test_name: The name of the test (e.g., "WBC", "Hemoglobin", "Ferritin")
- value: The numeric value (as a number, not string)
- unit: The unit of measurement (e.g., "K/uL", "mg/dL", "ng/mL")
- reference_range_low: Lower bound of reference range (number, or null if not visible)
- reference_range_high: Upper bound of reference range (number, or null if not visible)
- date: The date of the test if visible (YYYY-MM-DD format), or null
- category: Best guess category (CBC, Chemistry, Hormones, Iron Studies, Vitamins, Lipids, Thyroid, Coagulation, Liver, Other)

Respond with ONLY a JSON array of objects. No other text.
If you cannot read a value clearly, use your best estimate and add a "uncertain": true flag.
If the image is not a lab result document, respond with: {"error": "This does not appear to be a lab results document"}`

interface ScanRequestBody {
  image: string // base64 encoded
  mediaType: string
}

interface ExtractedResult {
  test_name: string
  value: number | null
  unit: string | null
  reference_range_low: number | null
  reference_range_high: number | null
  date: string | null
  category: string
  uncertain?: boolean
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ScanRequestBody

    if (!body.image || !body.mediaType) {
      return Response.json(
        { error: 'Missing required fields: image (base64), mediaType' },
        { status: 400 }
      )
    }

    // Validate media type (convert HEIC to jpeg since Claude doesn't support HEIC directly)
    let mediaType = body.mediaType.toLowerCase() as MediaType
    if (mediaType === ('image/heic' as MediaType)) {
      // HEIC images should be converted client-side before sending
      return Response.json(
        { error: 'HEIC images must be converted to JPEG before upload. Please try again.' },
        { status: 400 }
      )
    }

    if (!VALID_MEDIA_TYPES.includes(mediaType)) {
      return Response.json(
        { error: `Unsupported image type: ${body.mediaType}. Accepted: JPEG, PNG, WebP` },
        { status: 400 }
      )
    }

    // Check approximate size (base64 is ~33% larger than raw)
    const estimatedSize = (body.image.length * 3) / 4
    if (estimatedSize > MAX_IMAGE_SIZE) {
      return Response.json(
        { error: 'Image too large. Maximum file size is 10MB.' },
        { status: 400 }
      )
    }

    // Call Claude Vision
    const anthropic = new Anthropic()

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: body.image,
              },
            },
            {
              type: 'text',
              text: EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    })

    // Extract the text response
    const textBlock = response.content.find((block) => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return Response.json(
        { error: 'No response from AI. Please try again with a clearer photo.' },
        { status: 500 }
      )
    }

    const rawText = textBlock.text.trim()

    // Try to parse the JSON response
    let parsed: ExtractedResult[] | { error: string }
    try {
      // Claude sometimes wraps JSON in ```json ... ``` blocks
      let jsonStr = rawText
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
      }
      parsed = JSON.parse(jsonStr)
    } catch {
      return Response.json(
        { error: 'Could not parse lab results from the image. Please try a clearer photo.' },
        { status: 422 }
      )
    }

    // Check if it's an error response
    if (!Array.isArray(parsed)) {
      if ('error' in parsed) {
        return Response.json(
          { error: parsed.error },
          { status: 422 }
        )
      }
      return Response.json(
        { error: 'Unexpected response format. Please try again.' },
        { status: 422 }
      )
    }

    // Validate and clean each result
    const results: ExtractedResult[] = parsed.map((r) => ({
      test_name: String(r.test_name || '').trim(),
      value: typeof r.value === 'number' ? r.value : null,
      unit: r.unit ? String(r.unit).trim() : null,
      reference_range_low: typeof r.reference_range_low === 'number' ? r.reference_range_low : null,
      reference_range_high: typeof r.reference_range_high === 'number' ? r.reference_range_high : null,
      date: r.date ? String(r.date).trim() : null,
      category: r.category || 'Other',
      uncertain: r.uncertain === true,
    })).filter((r) => r.test_name.length > 0)

    return Response.json({
      success: true,
      results,
      count: results.length,
    })
  } catch (err) {
    console.error('Lab scan error:', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error processing lab photo' },
      { status: 500 }
    )
  }
}
