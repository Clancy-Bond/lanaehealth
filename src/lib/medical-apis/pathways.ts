import { getCached, setCache } from './cache'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KEGGPathway {
  id: string
  name: string
  description: string
  genes: { id: string; name: string }[]
  compounds: { id: string; name: string }[]
  rawText: string
}

interface ReactomeResult {
  pathway: string
  pathwayId: string
  entities: { found: number; total: number; ratio: number }
  pValue: number
  fdr: number
}

interface GEODataset {
  id: string
  title: string
  summary: string
  platform: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse KEGG flat-text format into structured sections.
 */
function parseKEGGText(raw: string): Partial<KEGGPathway> {
  const lines = raw.split('\n')
  let name = ''
  let description = ''
  const genes: { id: string; name: string }[] = []
  const compounds: { id: string; name: string }[] = []

  let currentSection = ''

  for (const line of lines) {
    // Section headers start at column 0 with uppercase letters
    if (/^[A-Z]/.test(line)) {
      const parts = line.split(/\s+/)
      currentSection = parts[0]
    }

    if (currentSection === 'NAME' && !name) {
      name = line.replace(/^NAME\s+/, '').trim()
    }

    if (currentSection === 'DESCRIPTION' || currentSection === 'DEFINITION') {
      const text = line.replace(/^(DESCRIPTION|DEFINITION)\s+/, '').trim()
      if (text) description += (description ? ' ' : '') + text
    }

    if (currentSection === 'GENE') {
      const geneMatch = line.trim().match(/^(\d+)\s+(.+)/)
      if (geneMatch) {
        genes.push({ id: geneMatch[1], name: geneMatch[2].split(';')[0].trim() })
      }
    }

    if (currentSection === 'COMPOUND') {
      const compMatch = line.trim().match(/^(C\d+)\s+(.+)/)
      if (compMatch) {
        compounds.push({ id: compMatch[1], name: compMatch[2].trim() })
      }
    }
  }

  return { name, description, genes, compounds }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch and parse a KEGG pathway entry by ID (e.g. "hsa04310").
 * KEGG returns flat text which we parse into structured data.
 */
export async function getKEGGPathway(
  pathwayId: string
): Promise<KEGGPathway | null> {
  const cacheKey = `kegg:${pathwayId}`
  const cached = await getCached('kegg', cacheKey)
  if (cached) return cached as KEGGPathway

  try {
    const res = await fetch(`https://rest.kegg.jp/get/${encodeURIComponent(pathwayId)}`)
    if (!res.ok) return null
    const rawText = await res.text()

    const parsed = parseKEGGText(rawText)
    const result: KEGGPathway = {
      id: pathwayId,
      name: parsed.name ?? '',
      description: parsed.description ?? '',
      genes: parsed.genes ?? [],
      compounds: parsed.compounds ?? [],
      rawText,
    }

    await setCache('kegg', cacheKey, result, 30)
    return result
  } catch (err) {
    console.warn('[pathways] KEGG request failed:', err)
    return null
  }
}

/**
 * Run Reactome pathway enrichment analysis on a list of gene symbols.
 * Submits genes as a newline-separated body to the projection analysis endpoint.
 */
export async function getReactomeEnrichment(
  geneList: string[]
): Promise<ReactomeResult[]> {
  if (geneList.length === 0) return []

  const key = geneList.sort().join(',')
  const cacheKey = `reactome:${key}`
  const cached = await getCached('reactome', cacheKey)
  if (cached) return cached as ReactomeResult[]

  try {
    const body = geneList.join('\n')
    const res = await fetch(
      'https://reactome.org/AnalysisService/identifiers/projection',
      {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body,
      }
    )
    if (!res.ok) return []
    const data = await res.json()

    const results: ReactomeResult[] = (data?.pathways ?? [])
      .slice(0, 20)
      .map((p: any) => ({
        pathway: p.name ?? '',
        pathwayId: p.stId ?? '',
        entities: {
          found: p.entities?.found ?? 0,
          total: p.entities?.total ?? 0,
          ratio: p.entities?.ratio ?? 0,
        },
        pValue: p.entities?.pValue ?? 1,
        fdr: p.entities?.fdr ?? 1,
      }))

    await setCache('reactome', cacheKey, results)
    return results
  } catch (err) {
    console.warn('[pathways] Reactome enrichment failed:', err)
    return []
  }
}

/**
 * Attempt to fetch endometriosis-specific gene expression data from EndometDB.
 * This is a best-effort call -- EndometDB may not expose a stable public API,
 * so this function degrades gracefully.
 */
export async function getEndometDBExpression(
  gene: string
): Promise<Record<string, any> | null> {
  const cacheKey = `endometdb:${gene}`
  const cached = await getCached('endometdb', cacheKey)
  if (cached) return cached

  try {
    // EndometDB does not have a documented REST API; attempt a search page fetch
    const res = await fetch(
      `https://endometdb.utu.fi/api/gene/${encodeURIComponent(gene)}`,
      { signal: AbortSignal.timeout(10_000) }
    )
    if (!res.ok) {
      console.warn(
        `[pathways] EndometDB returned ${res.status} for gene "${gene}" -- endpoint may not exist`
      )
      return null
    }
    const data = await res.json()
    await setCache('endometdb', cacheKey, data)
    return data
  } catch (err) {
    console.warn('[pathways] EndometDB fetch failed (expected if no public API):', err)
    return null
  }
}

/**
 * Search NCBI GEO DataSets (GDS) for datasets matching a query.
 * Useful for finding transcriptomic data related to a condition or gene.
 */
export async function getGEODatasets(query: string): Promise<GEODataset[]> {
  const ncbiKey = process.env.NCBI_API_KEY
  const apiParam = ncbiKey ? `&api_key=${ncbiKey}` : ''

  const cacheKey = `geo:${query}`
  const cached = await getCached('geo', cacheKey)
  if (cached) return cached as GEODataset[]

  try {
    // Step 1: search for IDs
    const searchRes = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=gds&term=${encodeURIComponent(query)}&retmode=json&retmax=5${apiParam}`
    )
    if (!searchRes.ok) return []
    const searchData = await searchRes.json()
    const ids: string[] = searchData?.esearchresult?.idlist ?? []
    if (ids.length === 0) return []

    // Step 2: fetch summaries
    const summaryRes = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=gds&id=${ids.join(',')}&retmode=json${apiParam}`
    )
    if (!summaryRes.ok) return []
    const summaryData = await summaryRes.json()

    const results: GEODataset[] = ids
      .map((id) => {
        const doc = summaryData?.result?.[id]
        if (!doc) return null
        return {
          id: doc.accession ?? id,
          title: doc.title ?? '',
          summary: doc.summary ?? '',
          platform: doc.gpl ?? '',
        }
      })
      .filter(Boolean) as GEODataset[]

    await setCache('geo', cacheKey, results)
    return results
  } catch (err) {
    console.warn('[pathways] GEO dataset search failed:', err)
    return []
  }
}
