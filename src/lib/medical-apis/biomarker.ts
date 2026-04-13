import { getCached, setCache } from './cache'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LOINCDetail {
  code: string
  display: string
  system: string
  properties: Record<string, string>
}

interface CTDAssociation {
  chemical: string
  gene: string
  disease: string
  interaction: string
}

interface MedlinePlusArticle {
  title: string
  url: string
  snippet: string
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Look up detailed information for a LOINC code via the FHIR LOINC CodeSystem.
 * LOINC credentials (LOINC_USERNAME / LOINC_PASSWORD) are sent via Basic auth
 * if available; the endpoint may work without auth for some operations.
 */
export async function getLOINCDetails(
  loincCode: string
): Promise<LOINCDetail | null> {
  const cacheKey = `loinc_detail:${loincCode}`
  const cached = await getCached('loinc_detail', cacheKey)
  if (cached) return cached as LOINCDetail

  const headers: Record<string, string> = {
    Accept: 'application/fhir+json',
  }
  const loincUser = process.env.LOINC_USERNAME
  const loincPass = process.env.LOINC_PASSWORD
  if (loincUser && loincPass) {
    headers.Authorization = `Basic ${btoa(`${loincUser}:${loincPass}`)}`
  }

  try {
    const res = await fetch(
      `https://fhir.loinc.org/CodeSystem/$lookup?system=http://loinc.org&code=${encodeURIComponent(loincCode)}`,
      { headers }
    )
    if (!res.ok) return null
    const data = await res.json()

    const properties: Record<string, string> = {}
    let display = ''

    for (const param of data?.parameter ?? []) {
      if (param.name === 'display') display = param.valueString ?? ''
      if (param.name === 'property' && param.part) {
        const code = param.part.find((p: any) => p.name === 'code')?.valueCode ?? ''
        const value =
          param.part.find((p: any) => p.name === 'value')?.valueString ??
          param.part.find((p: any) => p.name === 'value')?.valueCoding?.display ??
          ''
        if (code) properties[code] = value
      }
    }

    const result: LOINCDetail = {
      code: loincCode,
      display,
      system: 'http://loinc.org',
      properties,
    }

    await setCache('loinc_detail', cacheKey, result, 30)
    return result
  } catch (err) {
    console.warn('[biomarker] LOINC lookup failed:', err)
    return null
  }
}

/**
 * Query the Comparative Toxicogenomics Database (CTD) for chemical-gene-disease
 * associations using the batch query endpoint.
 */
export async function getCTDChemicalGeneDisease(
  chemical: string
): Promise<CTDAssociation[]> {
  const cacheKey = `ctd:${chemical.toLowerCase()}`
  const cached = await getCached('ctd', cacheKey)
  if (cached) return cached as CTDAssociation[]

  try {
    const res = await fetch(
      `https://ctdbase.org/tools/batchQuery.go?inputType=chem&inputTerms=${encodeURIComponent(chemical)}&report=genes_diseases&format=json`
    )
    if (!res.ok) return []
    const data = await res.json()

    const results: CTDAssociation[] = (Array.isArray(data) ? data : [])
      .slice(0, 50)
      .map((d: any) => ({
        chemical: d.ChemicalName ?? chemical,
        gene: d.GeneSymbol ?? '',
        disease: d.DiseaseName ?? '',
        interaction: d.Interaction ?? '',
      }))

    await setCache('ctd', cacheKey, results)
    return results
  } catch (err) {
    console.warn('[biomarker] CTD batch query failed:', err)
    return []
  }
}

/**
 * Fetch patient-friendly health information from MedlinePlus Connect
 * using an ICD-10-CM code.
 */
export async function getMedlinePlusInfo(
  icdCode: string
): Promise<MedlinePlusArticle[]> {
  const cacheKey = `medlineplus:${icdCode}`
  const cached = await getCached('medlineplus', cacheKey)
  if (cached) return cached as MedlinePlusArticle[]

  try {
    const res = await fetch(
      `https://connect.medlineplus.gov/service?mainSearchCriteria.v.cs=2.16.840.1.113883.6.90&mainSearchCriteria.v.c=${encodeURIComponent(icdCode)}&knowledgeResponseType=application/json`
    )
    if (!res.ok) return []
    const data = await res.json()

    const entries = data?.feed?.entry ?? []
    const results: MedlinePlusArticle[] = entries.map((e: any) => ({
      title: e.title?._value ?? '',
      url: (e.link ?? []).find((l: any) => l.rel === 'alternate')?.href ?? '',
      snippet: e.summary?._value ?? '',
    }))

    await setCache('medlineplus', cacheKey, results, 30)
    return results
  } catch (err) {
    console.warn('[biomarker] MedlinePlus request failed:', err)
    return []
  }
}
