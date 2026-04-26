import { getCached, setCache } from './cache'
import { arr, prop, str } from './_safe-access'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PubMedArticle {
  pmid: string
  title: string
  authors: string[]
  abstract: string
  journal: string
  year: string
}

interface ClinicalTrial {
  nctId: string
  title: string
  status: string
  conditions: string[]
  interventions: string[]
  startDate: string
  locations: string[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Very lightweight XML value extractor -- avoids pulling in a full XML parser.
 * Returns the text content of the first matching tag.
 */
function extractXmlTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i')
  const match = xml.match(regex)
  return match?.[1]?.trim() ?? ''
}

/**
 * Extract all occurrences of a tag's text content.
 */
function extractAllXmlTags(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi')
  const results: string[] = []
  let m: RegExpExecArray | null
  while ((m = regex.exec(xml)) !== null) {
    results.push(m[1].trim())
  }
  return results
}

/**
 * Parse a PubMed eFetch XML response into structured article objects.
 */
function parsePubMedXml(xml: string): PubMedArticle[] {
  // Split on <PubmedArticle> blocks
  const articleBlocks = xml.split('<PubmedArticle>').slice(1)
  return articleBlocks.map((block) => {
    const pmid = extractXmlTag(block, 'PMID')
    const title = extractXmlTag(block, 'ArticleTitle')
    const abstract = extractXmlTag(block, 'AbstractText')
    const journal = extractXmlTag(block, 'Title') // journal title
    const year =
      extractXmlTag(block, 'Year') ||
      extractXmlTag(block, 'MedlineDate')

    // Authors: extract <LastName> and <Initials> pairs
    const lastNames = extractAllXmlTags(block, 'LastName')
    const initials = extractAllXmlTags(block, 'Initials')
    const authors = lastNames.map((ln, i) =>
      initials[i] ? `${ln} ${initials[i]}` : ln
    )

    return { pmid, title, authors, abstract, journal, year }
  })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Two-step PubMed search: first esearch for PMIDs, then efetch for article details.
 * Returns structured article metadata including title, authors, abstract, journal, and year.
 */
export async function searchPubMed(
  query: string,
  maxResults: number = 10
): Promise<PubMedArticle[]> {
  const ncbiKey = process.env.NCBI_API_KEY
  const apiParam = ncbiKey ? `&api_key=${ncbiKey}` : ''

  const cacheKey = `pubmed:${query}:${maxResults}`
  const cached = await getCached('pubmed', cacheKey)
  if (cached) return cached as PubMedArticle[]

  try {
    // Step 1: get PMIDs
    const searchRes = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${maxResults}&retmode=json${apiParam}`
    )
    if (!searchRes.ok) return []
    const searchData: unknown = await searchRes.json()
    const pmids: string[] = arr(prop(searchData, 'esearchresult'), 'idlist').filter(
      (id): id is string => typeof id === 'string'
    )
    if (pmids.length === 0) return []

    // Step 2: fetch article details (XML -- PubMed does not support JSON for efetch)
    const fetchRes = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmids.join(',')}&retmode=xml${apiParam}`
    )
    if (!fetchRes.ok) return []
    const xml = await fetchRes.text()

    const articles = parsePubMedXml(xml)
    await setCache('pubmed', cacheKey, articles)
    return articles
  } catch (err) {
    console.warn('[research] PubMed search failed:', err)
    return []
  }
}

/**
 * Search ClinicalTrials.gov v2 API for recruiting studies matching a condition.
 * Optionally filter by geographic location.
 */
export async function searchClinicalTrials(
  condition: string,
  location?: string
): Promise<ClinicalTrial[]> {
  const cacheKey = `ctgov:${condition}:${location ?? ''}`
  const cached = await getCached('ctgov', cacheKey)
  if (cached) return cached as ClinicalTrial[]

  try {
    const params = new URLSearchParams({
      'query.cond': condition,
      'filter.overallStatus': 'RECRUITING',
      pageSize: '10',
    })
    if (location) params.set('query.locn', location)

    const res = await fetch(
      `https://clinicaltrials.gov/api/v2/studies?${params.toString()}`
    )
    if (!res.ok) return []
    const data: unknown = await res.json()

    const results: ClinicalTrial[] = arr(data, 'studies').map((study) => {
      const proto = prop(study, 'protocolSection')
      const id = prop(proto, 'identificationModule')
      const status = prop(proto, 'statusModule')
      const conditions = arr(prop(proto, 'conditionsModule'), 'conditions').filter(
        (c): c is string => typeof c === 'string'
      )
      const arms = arr(prop(proto, 'armsInterventionsModule'), 'interventions')
      const locs = arr(prop(proto, 'contactsLocationsModule'), 'locations')

      return {
        nctId: str(id, 'nctId'),
        title: str(id, 'briefTitle'),
        status: str(status, 'overallStatus'),
        conditions,
        interventions: arms.map((a) => str(a, 'name')),
        startDate: str(prop(status, 'startDateStruct'), 'date'),
        locations: locs.map((l) =>
          [str(l, 'facility'), str(l, 'city'), str(l, 'state'), str(l, 'country')]
            .filter(Boolean)
            .join(', ')
        ),
      }
    })

    await setCache('ctgov', cacheKey, results)
    return results
  } catch (err) {
    console.warn('[research] ClinicalTrials.gov search failed:', err)
    return []
  }
}
