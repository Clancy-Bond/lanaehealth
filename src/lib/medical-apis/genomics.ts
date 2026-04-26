import { getCached, setCache } from './cache'
import { arr, asArray, num, prop, str } from './_safe-access'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GeneDisease {
  geneSymbol: string
  diseaseName: string
  score: number
  source: string
}

interface OpenTargetsAssociation {
  targetId: string
  targetSymbol: string
  score: number
}

interface STRINGInteraction {
  preferredName_A: string
  preferredName_B: string
  score: number
}

interface UniProtEntry {
  accession: string
  proteinName: string
  geneName: string
  organism: string
  function?: string
  subcellularLocations?: string[]
}

interface NCBIGeneInfo {
  geneId: string
  symbol: string
  description: string
  chromosome: string
  mapLocation: string
  summary?: string
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get gene-disease associations from DisGeNET for a given gene symbol.
 * Falls back to Open Targets if DisGeNET API key is unavailable.
 */
export async function getDisGeNETAssociations(
  geneSymbol: string
): Promise<GeneDisease[]> {
  const apiKey = process.env.DISGENET_API_KEY
  if (!apiKey) {
    console.warn('[genomics] DISGENET_API_KEY not set, falling back to Open Targets')
    // Fall back: use Open Targets gene search as a proxy
    const otResults = await getOpenTargetsGeneAssociations(geneSymbol)
    return otResults.map((r) => ({
      geneSymbol,
      diseaseName: r.targetSymbol,
      score: r.score,
      source: 'OpenTargets',
    }))
  }

  const cacheKey = `disgenet:${geneSymbol}`
  const cached = await getCached('disgenet', cacheKey)
  if (cached) return cached as GeneDisease[]

  try {
    const res = await fetch(
      `https://www.disgenet.org/api/gda/gene/${encodeURIComponent(geneSymbol)}?source=ALL&format=json`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    )
    if (!res.ok) return []
    const data: unknown = await res.json()
    const results: GeneDisease[] = asArray(data).map((d) => ({
      geneSymbol: str(d, 'gene_symbol') || geneSymbol,
      diseaseName: str(d, 'disease_name'),
      score: num(d, 'score'),
      source: 'DisGeNET',
    }))
    await setCache('disgenet', cacheKey, results)
    return results
  } catch (err) {
    console.warn('[genomics] DisGeNET request failed:', err)
    return []
  }
}

/**
 * Internal helper: query Open Targets for genes associated with a gene symbol
 * (used as DisGeNET fallback).
 */
async function getOpenTargetsGeneAssociations(
  geneSymbol: string
): Promise<OpenTargetsAssociation[]> {
  const cacheKey = `ot_gene:${geneSymbol}`
  const cached = await getCached('opentargets_gene', cacheKey)
  if (cached) return cached as OpenTargetsAssociation[]

  const query = `
    query GeneAssociations($symbol: String!) {
      search(queryString: $symbol, entityNames: ["target"], page: { size: 1, index: 0 }) {
        hits {
          id
          object {
            ... on Target {
              id
              approvedSymbol
              associatedDiseases(page: { size: 10, index: 0 }) {
                rows {
                  disease { id name }
                  score
                }
              }
            }
          }
        }
      }
    }
  `

  try {
    const res = await fetch('https://api.platform.opentargets.org/api/v4/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { symbol: geneSymbol } }),
    })
    if (!res.ok) return []
    const data: unknown = await res.json()
    const hits = asArray(prop(prop(prop(data, 'data'), 'search'), 'hits'))
    const firstObject = prop(hits[0], 'object')
    const rows = arr(prop(firstObject, 'associatedDiseases'), 'rows')
    const results: OpenTargetsAssociation[] = rows.map((r) => ({
      targetId: str(prop(r, 'disease'), 'id'),
      targetSymbol: str(prop(r, 'disease'), 'name'),
      score: num(r, 'score'),
    }))
    await setCache('opentargets_gene', cacheKey, results)
    return results
  } catch {
    return []
  }
}

/**
 * Get associated targets (genes) for a disease EFO ID via Open Targets.
 */
export async function getOpenTargetsAssociations(
  diseaseId: string
): Promise<OpenTargetsAssociation[]> {
  const cacheKey = `ot_disease:${diseaseId}`
  const cached = await getCached('opentargets_disease', cacheKey)
  if (cached) return cached as OpenTargetsAssociation[]

  const query = `
    query DiseaseTargets($efoId: String!) {
      disease(efoId: $efoId) {
        associatedTargets(page: { size: 25, index: 0 }) {
          rows {
            target {
              id
              approvedSymbol
            }
            score
          }
        }
      }
    }
  `

  try {
    const res = await fetch('https://api.platform.opentargets.org/api/v4/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { efoId: diseaseId } }),
    })
    if (!res.ok) return []
    const data: unknown = await res.json()
    const associated = prop(prop(prop(data, 'data'), 'disease'), 'associatedTargets')
    const rows = arr(associated, 'rows')
    const results: OpenTargetsAssociation[] = rows.map((r) => ({
      targetId: str(prop(r, 'target'), 'id'),
      targetSymbol: str(prop(r, 'target'), 'approvedSymbol'),
      score: num(r, 'score'),
    }))
    await setCache('opentargets_disease', cacheKey, results)
    return results
  } catch (err) {
    console.warn('[genomics] Open Targets disease query failed:', err)
    return []
  }
}

/**
 * Get protein-protein interaction network from STRING-DB.
 */
export async function getSTRINGNetwork(
  proteins: string[]
): Promise<STRINGInteraction[]> {
  if (proteins.length === 0) return []

  const key = proteins.sort().join(',')
  const cacheKey = `string:${key}`
  const cached = await getCached('string_db', cacheKey)
  if (cached) return cached as STRINGInteraction[]

  try {
    const identifiers = proteins.join('%0d')
    const res = await fetch(
      `https://string-db.org/api/json/network?identifiers=${identifiers}&species=9606`
    )
    if (!res.ok) return []
    const data: unknown = await res.json()
    const results: STRINGInteraction[] = asArray(data).map((d) => ({
      preferredName_A: str(d, 'preferredName_A'),
      preferredName_B: str(d, 'preferredName_B'),
      score: num(d, 'score'),
    }))
    await setCache('string_db', cacheKey, results)
    return results
  } catch (err) {
    console.warn('[genomics] STRING-DB request failed:', err)
    return []
  }
}

/**
 * Fetch full protein details from UniProt by accession ID.
 */
export async function getUniProtDetails(
  uniprotId: string
): Promise<UniProtEntry | null> {
  const cacheKey = `uniprot_details:${uniprotId}`
  const cached = await getCached('uniprot_details', cacheKey)
  if (cached) return cached as UniProtEntry

  try {
    const res = await fetch(
      `https://rest.uniprot.org/uniprotkb/${encodeURIComponent(uniprotId)}?format=json`
    )
    if (!res.ok) return null
    const data: unknown = await res.json()

    const comments = arr(data, 'comments')
    const fnComment = comments.find((c) => str(c, 'commentType') === 'FUNCTION')
    const fnText = arr(fnComment, 'texts')[0]
    const fnValue = str(fnText, 'value')

    const subLocComment = comments.find(
      (c) => str(c, 'commentType') === 'SUBCELLULAR LOCATION'
    )
    const subLocs = arr(subLocComment, 'subcellularLocations').map((l) =>
      str(prop(l, 'location'), 'value')
    )

    const entry: UniProtEntry = {
      accession: str(data, 'primaryAccession') || uniprotId,
      proteinName: str(
        prop(prop(prop(data, 'proteinDescription'), 'recommendedName'), 'fullName'),
        'value'
      ),
      geneName: str(prop(arr(data, 'genes')[0], 'geneName'), 'value'),
      organism: str(prop(data, 'organism'), 'scientificName'),
      function: fnValue || undefined,
      subcellularLocations: subLocs.length > 0 ? subLocs : undefined,
    }

    await setCache('uniprot_details', cacheKey, entry, 30)
    return entry
  } catch (err) {
    console.warn('[genomics] UniProt request failed:', err)
    return null
  }
}

/**
 * Fetch gene summary information from NCBI Gene (Entrez).
 */
export async function getNCBIGeneInfo(
  geneId: string
): Promise<NCBIGeneInfo | null> {
  const ncbiKey = process.env.NCBI_API_KEY
  const apiParam = ncbiKey ? `&api_key=${ncbiKey}` : ''

  const cacheKey = `ncbi_gene_info:${geneId}`
  const cached = await getCached('ncbi_gene_info', cacheKey)
  if (cached) return cached as NCBIGeneInfo

  try {
    const res = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=gene&id=${encodeURIComponent(geneId)}&retmode=json${apiParam}`
    )
    if (!res.ok) return null
    const data: unknown = await res.json()
    const docSum = prop(prop(data, 'result'), geneId)
    if (!docSum) return null

    const summary = str(docSum, 'summary')
    const info: NCBIGeneInfo = {
      geneId,
      symbol: str(docSum, 'name'),
      description: str(docSum, 'description'),
      chromosome: str(docSum, 'chromosome'),
      mapLocation: str(docSum, 'maplocation'),
      summary: summary || undefined,
    }

    await setCache('ncbi_gene_info', cacheKey, info, 30)
    return info
  } catch (err) {
    console.warn('[genomics] NCBI gene info request failed:', err)
    return null
  }
}
