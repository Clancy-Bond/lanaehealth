// Tool definitions for the medical research chat agent
// Each tool maps to a function that queries Lanae's data or medical APIs

import { createServiceClient } from '@/lib/supabase'
import type { DailyLog, Symptom, PainPoint, FoodEntry, LabResult, OuraDaily, CycleEntry } from '@/lib/types'

// ---------------------------------------------------------------------------
// Tool Definitions (Anthropic tool_use format)
// ---------------------------------------------------------------------------

export const CHAT_TOOLS: Array<{
  name: string
  description: string
  input_schema: Record<string, unknown>
}> = [
  {
    name: 'search_daily_logs',
    description: 'Search Lanae\'s daily health logs by date range. Returns pain scores, fatigue, cycle phase, notes, what helped, and daily impact. Use this when she asks about how she felt on specific days or over a period.',
    input_schema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'Start date (YYYY-MM-DD). Defaults to 30 days ago if not specified.' },
        end_date: { type: 'string', description: 'End date (YYYY-MM-DD). Defaults to today if not specified.' },
        min_pain: { type: 'number', description: 'Optional: only return days with pain >= this value (0-10)' },
      },
      required: [],
    },
  },
  {
    name: 'search_symptoms',
    description: 'Search Lanae\'s logged symptoms. Can filter by specific symptom name, severity, or date range. Use this to find how often a symptom occurs, when it started, or what symptoms cluster together.',
    input_schema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        end_date: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        symptom_name: { type: 'string', description: 'Optional: filter by symptom name (e.g., "syncope", "bloating", "nausea")' },
        severity: { type: 'string', description: 'Optional: filter by severity ("mild", "moderate", "severe")' },
      },
      required: [],
    },
  },
  {
    name: 'get_lab_results',
    description: 'Get Lanae\'s lab results. Can filter by test name (e.g., "ferritin", "hemoglobin", "vitamin D", "hs-CRP") or date range. Returns values, reference ranges, and flags.',
    input_schema: {
      type: 'object',
      properties: {
        test_name: { type: 'string', description: 'Optional: filter by test name (partial match, case-insensitive)' },
        start_date: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        end_date: { type: 'string', description: 'End date (YYYY-MM-DD)' },
      },
      required: [],
    },
  },
  {
    name: 'get_oura_biometrics',
    description: 'Get Lanae\'s Oura Ring biometric data: HRV, resting heart rate, body temperature deviation, sleep score, SpO2, readiness score. Use this to check biometric trends around specific dates or symptoms.',
    input_schema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        end_date: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        metric: { type: 'string', description: 'Optional: focus on specific metric ("hrv", "resting_hr", "sleep_score", "body_temp_deviation", "spo2", "readiness_score")' },
      },
      required: [],
    },
  },
  {
    name: 'get_cycle_data',
    description: 'Get Lanae\'s menstrual cycle data: flow level, menstruation status, cycle phase, cervical mucus, symptoms. Use this to check cycle patterns, period dates, and flow heaviness.',
    input_schema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        end_date: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        menstruation_only: { type: 'boolean', description: 'If true, only return days with active menstruation' },
      },
      required: [],
    },
  },
  {
    name: 'search_food_entries',
    description: 'Search Lanae\'s food diary entries. Can filter by food description, meal type, or flagged triggers. Use this to find dietary patterns, iron-rich foods, absorption blockers, or trigger correlations.',
    input_schema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        end_date: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        search_term: { type: 'string', description: 'Optional: search food descriptions (e.g., "matcha", "spinach", "iron")' },
        meal_type: { type: 'string', description: 'Optional: filter by meal ("breakfast", "lunch", "dinner", "snack")' },
      },
      required: [],
    },
  },
  {
    name: 'search_pubmed',
    description: 'Search PubMed for medical research papers. Use specific medical terms for best results. Returns titles, authors, journal, year, and PMIDs. Use this when Lanae or Clancy ask about research evidence.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'PubMed search query (e.g., "endometriosis iron deficiency hepcidin", "ferritin threshold symptoms premenopausal")' },
        max_results: { type: 'number', description: 'Max papers to return (default 5, max 10)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_food_nutrients',
    description: 'Look up nutritional data for a specific food from the USDA database. Returns iron content, vitamin C, calcium, and other key nutrients. Use this when discussing diet and iron absorption.',
    input_schema: {
      type: 'object',
      properties: {
        food_name: { type: 'string', description: 'Food to look up (e.g., "matcha green tea", "beef liver", "spinach")' },
      },
      required: ['food_name'],
    },
  },
  {
    name: 'check_drug_interactions',
    description: 'Check for drug-drug interactions using RxNorm. Enter two or more drug names. Use this when discussing medication safety or new prescriptions.',
    input_schema: {
      type: 'object',
      properties: {
        drug_names: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of drug names to check interactions between',
        },
      },
      required: ['drug_names'],
    },
  },
  {
    name: 'get_health_profile',
    description: 'CALL THIS FIRST in every conversation. Returns Lanae\'s complete medical profile: all diagnoses, medications, supplements with doses and timing, complete lab results from all 3 draws, ferritin trajectory, menstrual/reproductive data, cardiovascular history, family history, pain descriptions, diet, weight history, healthcare providers, and recovery plan. This is the primary source of truth for her medical history.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_analysis_findings',
    description: 'Get the latest AI analysis findings from the pipeline. Can filter by category: diagnostic, medication, biomarker, pathway, research, trial, food, flare. Use this to reference previous analysis results.',
    input_schema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Optional: filter by category (diagnostic, medication, biomarker, pathway, research, trial, food, flare)' },
      },
      required: [],
    },
  },
  {
    name: 'get_hypothesis_status',
    description: 'Get the current hypothesis tracker from the Clinical Intelligence Engine. Shows all active diagnostic hypotheses with confidence categories (ESTABLISHED/PROBABLE/POSSIBLE/SPECULATIVE/INSUFFICIENT), supporting and contradicting evidence, the Challenger\'s assessment, and what would change each hypothesis. Use this when discussing diagnoses, differential diagnosis, or what conditions are most likely.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_next_best_actions',
    description: 'Get the ranked list of next best actions from the Clinical Intelligence Engine. Shows what tests, measurements, or data would most reduce diagnostic uncertainty, plus doctor visit briefs for upcoming appointments. Use this when preparing for doctor visits or discussing what to do next.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_research_context',
    description: 'Get relevant medical literature and clinical guidelines from the Clinical Intelligence Engine. Shows study quality cards with evidence grades (A-F), guideline alerts, and how studies relate to active hypotheses. Use this when discussing medical research, treatment options, or evidence for/against a diagnosis.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
]

// ---------------------------------------------------------------------------
// Tool Execution
// ---------------------------------------------------------------------------

function defaultStart(): string {
  const d = new Date()
  d.setDate(d.getDate() - 90)
  return d.toISOString().split('T')[0]
}

function defaultEnd(): string {
  return new Date().toISOString().split('T')[0]
}

export async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  try {
    switch (name) {
      case 'search_daily_logs':
        return await searchDailyLogs(input)
      case 'search_symptoms':
        return await searchSymptoms(input)
      case 'get_lab_results':
        return await getLabResults(input)
      case 'get_oura_biometrics':
        return await getOuraBiometrics(input)
      case 'get_cycle_data':
        return await getCycleData(input)
      case 'search_food_entries':
        return await searchFoodEntries(input)
      case 'search_pubmed':
        return await searchPubMed(input)
      case 'get_food_nutrients':
        return await getFoodNutrients(input)
      case 'check_drug_interactions':
        return await checkDrugInteractions(input)
      case 'get_health_profile':
        return await getHealthProfile()
      case 'get_analysis_findings':
        return await getAnalysisFindings(input)
      case 'get_hypothesis_status':
        return await getKBDocumentContent('hypothesis_tracker')
      case 'get_next_best_actions':
        return await getKBDocumentContent('next_best_actions')
      case 'get_research_context':
        return await getKBDocumentContent('research_context')
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` })
    }
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : 'Tool execution failed' })
  }
}

// ---------------------------------------------------------------------------
// Tool Implementations
// ---------------------------------------------------------------------------

async function searchDailyLogs(input: Record<string, unknown>): Promise<string> {
  const supabase = createServiceClient()
  const start = (input.start_date as string) || defaultStart()
  const end = (input.end_date as string) || defaultEnd()

  let query = supabase
    .from('daily_logs')
    .select('*')
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: false })
    .limit(60)

  if (input.min_pain != null) {
    query = query.gte('overall_pain', input.min_pain as number)
  }

  const { data } = await query
  const logs = (data || []) as DailyLog[]

  return JSON.stringify({
    count: logs.length,
    date_range: { start, end },
    logs: logs.map(l => ({
      date: l.date,
      pain: l.overall_pain,
      fatigue: l.fatigue,
      cycle_phase: l.cycle_phase,
      notes: l.notes,
      what_helped: l.what_helped,
      daily_impact: l.daily_impact,
    })),
  })
}

async function searchSymptoms(input: Record<string, unknown>): Promise<string> {
  const supabase = createServiceClient()
  const start = (input.start_date as string) || defaultStart()
  const end = (input.end_date as string) || defaultEnd()

  // Get log IDs in range
  const { data: logs } = await supabase
    .from('daily_logs')
    .select('id, date')
    .gte('date', start)
    .lte('date', end)

  if (!logs || logs.length === 0) return JSON.stringify({ count: 0, symptoms: [] })

  const logIds = logs.map(l => (l as DailyLog).id)
  const logDateMap = new Map(logs.map(l => [(l as DailyLog).id, (l as DailyLog).date]))

  let query = supabase.from('symptoms').select('*').in('log_id', logIds)

  if (input.symptom_name) {
    query = query.ilike('symptom', `%${input.symptom_name}%`)
  }
  if (input.severity) {
    query = query.eq('severity', input.severity)
  }

  const { data } = await query
  const symptoms = (data || []) as Symptom[]

  // Count by symptom name
  const counts: Record<string, number> = {}
  for (const s of symptoms) {
    counts[s.symptom] = (counts[s.symptom] || 0) + 1
  }

  return JSON.stringify({
    count: symptoms.length,
    date_range: { start, end },
    symptom_counts: Object.entries(counts).sort((a, b) => b[1] - a[1]),
    recent: symptoms.slice(0, 30).map(s => ({
      date: logDateMap.get(s.log_id) || 'unknown',
      symptom: s.symptom,
      severity: s.severity,
    })),
  })
}

async function getLabResults(input: Record<string, unknown>): Promise<string> {
  const supabase = createServiceClient()

  let query = supabase.from('lab_results').select('*').order('date', { ascending: false })

  if (input.start_date) query = query.gte('date', input.start_date as string)
  if (input.end_date) query = query.lte('date', input.end_date as string)
  if (input.test_name) query = query.ilike('test_name', `%${input.test_name}%`)

  const { data } = await query
  const labs = (data || []) as LabResult[]

  return JSON.stringify({
    count: labs.length,
    results: labs.map(l => ({
      date: l.date,
      test: l.test_name,
      value: l.value,
      unit: l.unit,
      reference_low: l.reference_range_low,
      reference_high: l.reference_range_high,
      flag: l.flag,
    })),
  })
}

async function getOuraBiometrics(input: Record<string, unknown>): Promise<string> {
  const supabase = createServiceClient()
  const start = (input.start_date as string) || defaultStart()
  const end = (input.end_date as string) || defaultEnd()

  const { data } = await supabase
    .from('oura_daily')
    .select('*')
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: false })
    .limit(90)

  const oura = (data || []) as OuraDaily[]

  // Compute averages
  const metric = input.metric as string | undefined
  const values: Record<string, number[]> = {
    hrv: [], resting_hr: [], sleep_score: [],
    body_temp_deviation: [], spo2: [], readiness_score: [],
  }

  for (const o of oura) {
    if (o.hrv_avg != null) values.hrv.push(o.hrv_avg)
    if (o.resting_hr != null) values.resting_hr.push(o.resting_hr)
    if (o.sleep_score != null) values.sleep_score.push(o.sleep_score)
    if (o.body_temp_deviation != null) values.body_temp_deviation.push(o.body_temp_deviation)
    if (o.spo2_avg != null) values.spo2.push(o.spo2_avg)
    if (o.readiness_score != null) values.readiness_score.push(o.readiness_score)
  }

  function avg(arr: number[]): number | null {
    return arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : null
  }

  const averages: Record<string, number | null> = {}
  for (const [k, v] of Object.entries(values)) {
    averages[k] = avg(v)
  }

  const result: Record<string, unknown> = {
    count: oura.length,
    date_range: { start, end },
    averages,
  }

  if (metric && values[metric]) {
    result.daily_values = oura.map(o => ({
      date: o.date,
      value: (o as unknown as Record<string, unknown>)[metric === 'hrv' ? 'hrv_avg' : metric === 'spo2' ? 'spo2_avg' : metric],
    }))
  } else {
    result.recent = oura.slice(0, 14).map(o => ({
      date: o.date,
      hrv: o.hrv_avg,
      resting_hr: o.resting_hr,
      sleep_score: o.sleep_score,
      temp_deviation: o.body_temp_deviation,
      readiness: o.readiness_score,
    }))
  }

  return JSON.stringify(result)
}

async function getCycleData(input: Record<string, unknown>): Promise<string> {
  const supabase = createServiceClient()
  const start = (input.start_date as string) || defaultStart()
  const end = (input.end_date as string) || defaultEnd()

  let query = supabase
    .from('cycle_entries')
    .select('*')
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: false })

  if (input.menstruation_only) {
    query = query.eq('menstruation', true)
  }

  const { data } = await query
  const entries = (data || []) as CycleEntry[]

  return JSON.stringify({
    count: entries.length,
    date_range: { start, end },
    entries: entries.map(e => ({
      date: e.date,
      menstruation: e.menstruation,
      flow_level: e.flow_level,
      ovulation_signs: e.ovulation_signs,
      lh_test: e.lh_test_result,
      cervical_mucus: e.cervical_mucus_consistency,
    })),
  })
}

async function searchFoodEntries(input: Record<string, unknown>): Promise<string> {
  const supabase = createServiceClient()
  const start = (input.start_date as string) || defaultStart()
  const end = (input.end_date as string) || defaultEnd()

  // Get log IDs in range
  const { data: logs } = await supabase
    .from('daily_logs')
    .select('id, date')
    .gte('date', start)
    .lte('date', end)

  if (!logs || logs.length === 0) return JSON.stringify({ count: 0, entries: [] })

  const logIds = logs.map(l => (l as DailyLog).id)
  const logDateMap = new Map(logs.map(l => [(l as DailyLog).id, (l as DailyLog).date]))

  let query = supabase.from('food_entries').select('*').in('log_id', logIds)

  if (input.search_term) {
    query = query.ilike('food_items', `%${input.search_term}%`)
  }
  if (input.meal_type) {
    query = query.eq('meal_type', input.meal_type)
  }

  const { data } = await query.limit(100)
  const entries = (data || []) as FoodEntry[]

  return JSON.stringify({
    count: entries.length,
    entries: entries.map(e => ({
      date: logDateMap.get(e.log_id) || 'unknown',
      meal_type: e.meal_type,
      food_items: e.food_items,
      flagged_triggers: e.flagged_triggers,
    })),
  })
}

async function searchPubMed(input: Record<string, unknown>): Promise<string> {
  const query = input.query as string
  const maxResults = Math.min((input.max_results as number) || 5, 10)
  const ncbiKey = process.env.NCBI_API_KEY ? `&api_key=${process.env.NCBI_API_KEY}` : ''

  // Step 1: Search
  const searchRes = await fetch(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${maxResults}&retmode=json${ncbiKey}`
  )
  if (!searchRes.ok) return JSON.stringify({ error: 'PubMed search failed' })
  const searchData = await searchRes.json()
  const ids: string[] = searchData?.esearchresult?.idlist || []

  if (ids.length === 0) return JSON.stringify({ count: 0, papers: [] })

  // Step 2: Fetch details
  const detailRes = await fetch(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json${ncbiKey}`
  )
  if (!detailRes.ok) return JSON.stringify({ error: 'PubMed fetch failed' })
  const detailData = await detailRes.json()

  const papers = ids.map(id => {
    const d = detailData?.result?.[id]
    if (!d) return null
    return {
      pmid: id,
      title: d.title,
      authors: d.authors?.slice(0, 3).map((a: { name: string }) => a.name).join(', '),
      journal: d.fulljournalname || d.source,
      year: d.pubdate?.split(' ')[0],
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
    }
  }).filter(Boolean)

  return JSON.stringify({ count: papers.length, query, papers })
}

async function getFoodNutrients(input: Record<string, unknown>): Promise<string> {
  const foodName = input.food_name as string
  const apiKey = process.env.USDA_API_KEY || ''

  const res = await fetch(
    `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(foodName)}&pageSize=1&api_key=${apiKey}`
  )
  if (!res.ok) return JSON.stringify({ error: 'USDA lookup failed' })
  const data = await res.json()

  const food = data?.foods?.[0]
  if (!food) return JSON.stringify({ error: `No results for "${foodName}"` })

  const nutrients: Record<string, string> = {}
  const targetNutrients = ['Iron', 'Vitamin C', 'Calcium', 'Fiber', 'Protein', 'Energy']

  for (const n of food.foodNutrients || []) {
    for (const target of targetNutrients) {
      if (n.nutrientName?.includes(target)) {
        nutrients[n.nutrientName] = `${n.value} ${n.unitName}`
      }
    }
  }

  return JSON.stringify({
    food: food.description,
    brand: food.brandName || null,
    category: food.foodCategory,
    serving_size: food.servingSize ? `${food.servingSize} ${food.servingSizeUnit}` : null,
    nutrients,
  })
}

async function checkDrugInteractions(input: Record<string, unknown>): Promise<string> {
  const drugNames = input.drug_names as string[]

  // Resolve each drug to RxCUI
  const rxcuis: { name: string; rxcui: string }[] = []
  for (const drug of drugNames) {
    const res = await fetch(
      `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(drug)}`
    )
    if (!res.ok) continue
    const data = await res.json()
    const ids = data?.idGroup?.rxnormId
    if (Array.isArray(ids) && ids.length > 0) {
      rxcuis.push({ name: drug, rxcui: ids[0] })
    }
  }

  if (rxcuis.length < 2) {
    return JSON.stringify({ message: 'Need at least 2 resolved drugs to check interactions', resolved: rxcuis })
  }

  // Check interactions
  const cuiList = rxcuis.map(r => r.rxcui).join('+')
  const interRes = await fetch(
    `https://rxnav.nlm.nih.gov/REST/interaction/list.json?rxcuis=${cuiList}`
  )
  if (!interRes.ok) return JSON.stringify({ error: 'Interaction check failed' })
  const interData = await interRes.json()

  const interactions: { drugs: string; severity: string; description: string }[] = []
  const pairs = interData?.fullInteractionTypeGroup?.[0]?.fullInteractionType || []

  for (const pair of pairs) {
    for (const ip of pair.interactionPair || []) {
      interactions.push({
        drugs: ip.interactionConcept?.map((c: { minConceptItem: { name: string } }) => c.minConceptItem?.name).join(' + ') || 'Unknown',
        severity: ip.severity || 'Unknown',
        description: ip.description || '',
      })
    }
  }

  return JSON.stringify({ resolved_drugs: rxcuis, interactions })
}

async function getHealthProfile(): Promise<string> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('health_profile')
    .select('content')
    .eq('section', 'full_profile')
    .limit(1)
    .single()

  if (!data) return JSON.stringify({ error: 'Health profile not found in database' })
  return data.content
}

async function getAnalysisFindings(input: Record<string, unknown>): Promise<string> {
  const supabase = createServiceClient()

  // Get latest completed run
  const { data: runs } = await supabase
    .from('analysis_runs')
    .select('id')
    .eq('status', 'complete')
    .order('completed_at', { ascending: false })
    .limit(1)

  if (!runs || runs.length === 0) {
    return JSON.stringify({ message: 'No analysis has been run yet. Go to the Insights tab and click Run Analysis first.' })
  }

  let query = supabase
    .from('analysis_findings')
    .select('*')
    .eq('run_id', runs[0].id)
    .order('confidence', { ascending: false })

  if (input.category) {
    query = query.eq('category', input.category as string)
  }

  const { data } = await query
  return JSON.stringify({
    count: (data || []).length,
    findings: (data || []).map((f: Record<string, unknown>) => ({
      category: f.category,
      title: f.title,
      summary: f.summary,
      confidence: f.confidence,
      significance: f.clinical_significance,
    })),
  })
}

// ---------------------------------------------------------------------------
// Knowledge Base Document Reader (for intelligence engine tools)
// ---------------------------------------------------------------------------

async function getKBDocumentContent(documentId: string): Promise<string> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('clinical_knowledge_base')
    .select('content, title, generated_at, is_stale')
    .eq('document_id', documentId)
    .single()

  if (error || !data) {
    return JSON.stringify({
      error: `No ${documentId} found. The Clinical Intelligence Engine may not have run yet. Try asking about a different topic or request an analysis.`,
    })
  }

  const staleNote = data.is_stale ? '\n\n[NOTE: This document is STALE and may not reflect the latest data.]' : ''
  return `# ${data.title}\nLast updated: ${data.generated_at}\n\n${data.content}${staleNote}`
}
