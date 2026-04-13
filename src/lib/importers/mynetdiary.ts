// MyNetDiary CSV parser
// Expected columns: Date, Meal, Food Name/Description, Amount/Serving,
// Calories, Fat (g), Carbs (g), Protein (g), Fiber (g), Sugar (g), Sodium (mg)
// Optional: Water (fl oz), Cholesterol (mg)

export interface MndMacros {
  fat: number | null
  carbs: number | null
  protein: number | null
  fiber: number | null
  sugar: number | null
  sodium: number | null
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface MndRow {
  date: string
  meal_type: MealType
  food_items: string
  calories: number | null
  macros: MndMacros
  raw_line: string
}

export function parseMyNetDiaryCsv(csvText: string): MndRow[] {
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) return []

  // Parse header row (handle possible BOM)
  const headerLine = lines[0].replace(/^\uFEFF/, '')
  const headers = headerLine.split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase())

  function findCol(keywords: string[]): number {
    return headers.findIndex((h) =>
      keywords.some((kw) => h.includes(kw))
    )
  }

  const dateIdx = findCol(['date'])
  const mealIdx = findCol(['meal'])
  const foodIdx = findCol(['food name', 'food description', 'description', 'food item', 'food'])
  const amountIdx = findCol(['amount', 'serving size', 'serving', 'quantity'])
  const calIdx = findCol(['calories', 'cals', 'kcal', 'energy'])
  const fatIdx = findCol(['fat'])
  const carbIdx = findCol(['carb'])
  const proteinIdx = findCol(['protein', 'prot'])
  const fiberIdx = findCol(['fiber', 'fibre'])
  const sugarIdx = findCol(['sugar'])
  const sodiumIdx = findCol(['sodium', 'salt', 'na '])

  if (dateIdx === -1) {
    throw new Error('Could not find a Date column in the CSV. Please check the file format.')
  }
  if (foodIdx === -1) {
    throw new Error('Could not find a Food Name/Description column in the CSV. Please check the file format.')
  }

  const rows: MndRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const cols = splitCsvLine(line)

    const dateVal = cols[dateIdx]?.trim()
    if (!dateVal) continue

    const normalizedDate = normalizeDate(dateVal)
    if (!normalizedDate) continue

    const foodName = cols[foodIdx]?.trim()
    if (!foodName) continue

    // If there's a serving/amount column, append it to food name for context
    const amount = amountIdx >= 0 ? cols[amountIdx]?.trim() : null
    const foodItems = amount ? `${foodName} (${amount})` : foodName

    const mealRaw = mealIdx >= 0 ? cols[mealIdx]?.trim().toLowerCase() : ''
    const mealType = normalizeMealType(mealRaw)

    rows.push({
      date: normalizedDate,
      meal_type: mealType,
      food_items: foodItems,
      calories: calIdx >= 0 ? parseNum(cols[calIdx]) : null,
      macros: {
        fat: fatIdx >= 0 ? parseNum(cols[fatIdx]) : null,
        carbs: carbIdx >= 0 ? parseNum(cols[carbIdx]) : null,
        protein: proteinIdx >= 0 ? parseNum(cols[proteinIdx]) : null,
        fiber: fiberIdx >= 0 ? parseNum(cols[fiberIdx]) : null,
        sugar: sugarIdx >= 0 ? parseNum(cols[sugarIdx]) : null,
        sodium: sodiumIdx >= 0 ? parseNum(cols[sodiumIdx]) : null,
      },
      raw_line: line,
    })
  }

  return rows
}

function normalizeMealType(raw: string): MealType {
  if (!raw) return 'snack'
  const lower = raw.toLowerCase()
  if (lower.includes('breakfast') || lower.includes('morning')) return 'breakfast'
  if (lower.includes('lunch') || lower.includes('midday') || lower.includes('mid-day')) return 'lunch'
  if (lower.includes('dinner') || lower.includes('supper') || lower.includes('evening')) return 'dinner'
  if (lower.includes('snack') || lower.includes('other') || lower.includes('extra')) return 'snack'
  return 'snack'
}

function parseNum(val: string | undefined): number | null {
  if (!val) return null
  const cleaned = val.trim().replace(/[^0-9.\-]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

function splitCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

function normalizeDate(dateStr: string): string | null {
  // Try common formats: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, DD-MM-YYYY
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) return dateStr.slice(0, 10)

  const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (slashMatch) {
    const [, a, b, year] = slashMatch
    // Assume MM/DD/YYYY for US-style (MyNetDiary default)
    return `${year}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`
  }

  const dashMatch = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/)
  if (dashMatch) {
    const [, a, b, year] = dashMatch
    return `${year}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`
  }

  return null
}
