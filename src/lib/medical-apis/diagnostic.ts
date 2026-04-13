import { getCached, setCache } from './cache'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InfermedicaSymptom {
  id: string
  choice_id: string
}

interface InfermedicaDiagnosisResult {
  conditions: {
    id: string
    name: string
    common_name: string
    probability: number
  }[]
  question?: {
    text: string
    items: { id: string; name: string; choices: { id: string; label: string }[] }[]
  }
  should_stop?: boolean
}

interface HPODiseaseAssociation {
  hpoId: string
  diseases: string[]
}

interface MonarchMatch {
  subject: { id: string; label: string }
  score: number
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Submit a symptom set to the Infermedica diagnosis engine.
 * Returns ranked condition probabilities and optional follow-up questions.
 */
export async function getInfermedicaDiagnosis(
  symptoms: InfermedicaSymptom[],
  age: number,
  sex: string
): Promise<InfermedicaDiagnosisResult | null> {
  const appId = process.env.INFERMEDICA_APP_ID
  const appKey = process.env.INFERMEDICA_APP_KEY
  if (!appId || !appKey) {
    console.warn('[diagnostic] INFERMEDICA_APP_ID or INFERMEDICA_APP_KEY not set')
    return null
  }

  const cacheKey = `infermedica:${JSON.stringify(symptoms)}:${age}:${sex}`
  const cached = await getCached('infermedica', cacheKey)
  if (cached) return cached as InfermedicaDiagnosisResult

  try {
    const res = await fetch('https://api.infermedica.com/v3/diagnosis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'App-Id': appId,
        'App-Key': appKey,
      },
      body: JSON.stringify({
        sex,
        age: { value: age },
        evidence: symptoms.map((s) => ({
          id: s.id,
          choice_id: s.choice_id,
          source: 'initial',
        })),
      }),
    })
    if (!res.ok) return null
    const data: InfermedicaDiagnosisResult = await res.json()
    await setCache('infermedica', cacheKey, data)
    return data
  } catch (err) {
    console.warn('[diagnostic] Infermedica request failed:', err)
    return null
  }
}

/**
 * Retrieve diseases associated with each HPO phenotype ID via NLM Clinical Tables.
 */
export async function getHPODiseaseAssociations(
  hpoIds: string[]
): Promise<HPODiseaseAssociation[]> {
  const results: HPODiseaseAssociation[] = []

  for (const hpoId of hpoIds) {
    const cacheKey = `hpo_diseases:${hpoId}`
    let data = await getCached('hpo_diseases', cacheKey)

    if (!data) {
      try {
        const res = await fetch(
          `https://clinicaltables.nlm.nih.gov/api/hpo/v3/search?terms=${encodeURIComponent(hpoId)}&ef=associated_diseases`
        )
        if (!res.ok) continue
        data = await res.json()
        await setCache('hpo_diseases', cacheKey, data)
      } catch (err) {
        console.warn(`[diagnostic] HPO disease lookup failed for ${hpoId}:`, err)
        continue
      }
    }

    // Response shape: [count, codes, extraFields, displayStrings]
    const diseases = data?.[2]?.associated_diseases?.flat?.() ?? []
    results.push({ hpoId, diseases })
  }

  return results
}

/**
 * Use the Monarch Initiative semantic similarity search to match an HPO
 * phenotype profile against known disease phenotypes.
 */
export async function getMonarchPhenotypeMatch(
  hpoIds: string[]
): Promise<MonarchMatch[] | null> {
  if (hpoIds.length === 0) return []

  const cacheKey = `monarch:${hpoIds.sort().join(',')}`
  const cached = await getCached('monarch', cacheKey)
  if (cached) return cached as MonarchMatch[]

  try {
    const res = await fetch('https://api.monarchinitiative.org/v3/api/semsim/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        termset: hpoIds,
        group: 'MONDO',
        limit: 20,
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const matches: MonarchMatch[] = (data?.results ?? []).map((r: any) => ({
      subject: { id: r.subject?.id ?? '', label: r.subject?.label ?? '' },
      score: r.score ?? 0,
    }))
    await setCache('monarch', cacheKey, matches)
    return matches
  } catch (err) {
    console.warn('[diagnostic] Monarch phenotype match failed:', err)
    return null
  }
}
