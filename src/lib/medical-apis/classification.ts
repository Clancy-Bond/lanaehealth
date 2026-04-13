import { getCached, setCache } from './cache'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OLS4Term {
  iri: string
  label: string
  description: string[]
  oboId: string
  crossReferences: string[]
  synonyms: string[]
}

interface OrphanetEntity {
  orphaCode: string
  name: string
  definition: string
  prevalence?: string
  inheritanceMode?: string
  ageOfOnset?: string
}

interface BioPortalMapping {
  id: string
  prefLabel: string
  ontology: string
  cui: string[]
  semanticTypes: string[]
}

interface WHOICD11Result {
  code: string
  title: string
  definition: string
  parent?: string
  browserUrl: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Obtain a WHO ICD-11 OAuth token. The token endpoint requires a client_id
 * and client_secret set via WHO_ICD_CLIENT_ID / WHO_ICD_CLIENT_SECRET env vars.
 * Returns null if credentials are not configured.
 */
async function getWHOToken(): Promise<string | null> {
  const clientId = process.env.WHO_ICD_CLIENT_ID
  const clientSecret = process.env.WHO_ICD_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.warn('[classification] WHO_ICD_CLIENT_ID / WHO_ICD_CLIENT_SECRET not set')
    return null
  }

  // Check cache for existing token (short TTL)
  const cached = await getCached('who_token', 'current')
  if (cached) return cached as string

  try {
    const res = await fetch('https://icdaccessmanagement.who.int/connect/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'icdapi_access',
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const token = data?.access_token ?? null
    if (token) {
      // Cache token for ~1 hour (WHO tokens typically last 1h)
      await setCache('who_token', 'current', token, 0.04)
    }
    return token
  } catch (err) {
    console.warn('[classification] WHO OAuth token request failed:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Look up a MONDO ontology term in OLS4 and retrieve its cross-references,
 * synonyms, and descriptions. Useful for mapping MONDO IDs to other coding systems.
 */
export async function getOLS4CrossReferences(
  mondoId: string
): Promise<OLS4Term | null> {
  const cacheKey = `ols4:${mondoId}`
  const cached = await getCached('ols4', cacheKey)
  if (cached) return cached as OLS4Term

  try {
    const iri = encodeURIComponent(
      `http://purl.obolibrary.org/obo/${mondoId.replace(':', '_')}`
    )
    const res = await fetch(
      `https://www.ebi.ac.uk/ols4/api/ontologies/mondo/terms?iri=${iri}`
    )
    if (!res.ok) return null
    const data = await res.json()
    const term = data?._embedded?.terms?.[0]
    if (!term) return null

    const result: OLS4Term = {
      iri: term.iri ?? '',
      label: term.label ?? '',
      description: term.description ?? [],
      oboId: term.obo_id ?? mondoId,
      crossReferences: term.obo_xref?.map((x: any) => `${x.database}:${x.id}`) ?? [],
      synonyms: term.synonyms ?? [],
    }

    await setCache('ols4', cacheKey, result, 30)
    return result
  } catch (err) {
    console.warn('[classification] OLS4 lookup failed:', err)
    return null
  }
}

/**
 * Retrieve clinical entity information from the Orphanet rare disease API
 * by ORPHAcode number.
 */
export async function getOrphanetInfo(
  orphaCode: string
): Promise<OrphanetEntity | null> {
  const cacheKey = `orphanet:${orphaCode}`
  const cached = await getCached('orphanet', cacheKey)
  if (cached) return cached as OrphanetEntity

  try {
    const res = await fetch(
      `https://api.orphacode.org/EN/ClinicalEntity/orphacode/${encodeURIComponent(orphaCode)}`,
      { headers: { Accept: 'application/json' } }
    )
    if (!res.ok) return null
    const data = await res.json()

    const result: OrphanetEntity = {
      orphaCode: data.ORPHAcode?.toString() ?? orphaCode,
      name: data.Preferred_term ?? '',
      definition: data.Definition ?? '',
      prevalence: data.AverageAgeOfOnset ?? undefined,
      inheritanceMode: data.TypeOfInheritance ?? undefined,
      ageOfOnset: data.AverageAgeOfOnset ?? undefined,
    }

    await setCache('orphanet', cacheKey, result, 30)
    return result
  } catch (err) {
    console.warn('[classification] Orphanet lookup failed:', err)
    return null
  }
}

/**
 * Search BioPortal for ontology mappings matching a UMLS CUI or search term.
 * Works with or without an API key (anonymous access has rate limits).
 */
export async function getBioPortalMappings(
  cui: string
): Promise<BioPortalMapping[]> {
  const apiKey = process.env.BIOPORTAL_API_KEY || 'anonymous'

  const cacheKey = `bioportal:${cui}`
  const cached = await getCached('bioportal', cacheKey)
  if (cached) return cached as BioPortalMapping[]

  try {
    const res = await fetch(
      `https://data.bioontology.org/search?q=${encodeURIComponent(cui)}&apikey=${apiKey}`
    )
    if (!res.ok) return []
    const data = await res.json()

    const results: BioPortalMapping[] = (data?.collection ?? [])
      .slice(0, 20)
      .map((item: any) => ({
        id: item['@id'] ?? '',
        prefLabel: item.prefLabel ?? '',
        ontology: item.links?.ontology ?? '',
        cui: item.cui ?? [],
        semanticTypes: item.semanticType ?? [],
      }))

    await setCache('bioportal', cacheKey, results, 30)
    return results
  } catch (err) {
    console.warn('[classification] BioPortal search failed:', err)
    return []
  }
}

/**
 * Search the WHO ICD-11 Mortality and Morbidity Statistics (MMS) for a code
 * or search term. Requires WHO OAuth credentials.
 */
export async function getWHOICD11(code: string): Promise<WHOICD11Result | null> {
  const cacheKey = `who_icd11:${code}`
  const cached = await getCached('who_icd11', cacheKey)
  if (cached) return cached as WHOICD11Result

  const token = await getWHOToken()
  if (!token) return null

  try {
    const res = await fetch(
      `https://id.who.int/icd/release/11/2024-01/mms/search?q=${encodeURIComponent(code)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Accept-Language': 'en',
          'API-Version': 'v2',
        },
      }
    )
    if (!res.ok) return null
    const data = await res.json()

    const first = data?.destinationEntities?.[0]
    if (!first) return null

    const result: WHOICD11Result = {
      code: first.theCode ?? code,
      title: first.title ?? '',
      definition: first.definition ?? '',
      parent: first.parent?.[0] ?? undefined,
      browserUrl: first.id ?? '',
    }

    await setCache('who_icd11', cacheKey, result, 30)
    return result
  } catch (err) {
    console.warn('[classification] WHO ICD-11 search failed:', err)
    return null
  }
}
