import { createServiceClient } from '@/lib/supabase'
import { getCached, setCache } from './cache'
import { arr, prop, str } from './_safe-access'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ResolvedIdentifier {
  term: string
  type: string
  cui?: string | null
  hpoId?: string | null
  mondoId?: string | null
  rxcui?: string | null
  loincCode?: string | null
  geneId?: string | null
  uniprotId?: string | null
}

interface HealthProfile {
  symptoms?: string[]
  conditions?: string[]
  medications?: string[]
  genes?: string[]
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const UMLS_API_KEY = process.env.UMLS_API_KEY ?? ''
const NCBI_API_KEY = process.env.NCBI_API_KEY ?? ''

async function fetchJson(url: string, headers?: Record<string, string>): Promise<unknown> {
  try {
    const res = await fetch(url, { headers })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/**
 * Check if an identifier already exists in the medical_identifiers table.
 */
async function getStoredIdentifier(term: string, type: string): Promise<ResolvedIdentifier | null> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('medical_identifiers')
      .select('*')
      .eq('term', term.toLowerCase())
      .eq('type', type)
      .limit(1)
      .single()

    if (error || !data) return null
    return data as ResolvedIdentifier
  } catch {
    return null
  }
}

/**
 * Persist an identifier to the medical_identifiers table.
 */
async function storeIdentifier(record: ResolvedIdentifier): Promise<void> {
  try {
    const supabase = createServiceClient()
    await supabase.from('medical_identifiers').upsert(
      { ...record, term: record.term.toLowerCase() },
      { onConflict: 'term,type' }
    )
  } catch (err) {
    console.warn('[identity-resolver] Failed to store identifier:', err)
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve a plain-text symptom into UMLS CUI and HPO ID.
 */
export async function resolveSymptom(term: string): Promise<ResolvedIdentifier | null> {
  const stored = await getStoredIdentifier(term, 'symptom')
  if (stored) return stored

  const result: ResolvedIdentifier = { term, type: 'symptom', cui: null, hpoId: null }

  // UMLS lookup
  if (UMLS_API_KEY) {
    const cacheKey = `umls:${term}`
    let umls = await getCached('umls', cacheKey)
    if (!umls) {
      umls = await fetchJson(
        `https://uts-ws.nlm.nih.gov/rest/search/current?string=${encodeURIComponent(term)}&apiKey=${UMLS_API_KEY}`
      )
      if (umls) await setCache('umls', cacheKey, umls)
    }
    const firstResult = arr(prop(umls, 'result'), 'results')[0]
    const ui = str(firstResult, 'ui')
    if (ui) result.cui = ui
  } else {
    console.warn('[identity-resolver] UMLS_API_KEY not set, skipping UMLS lookup')
  }

  // HPO lookup via NLM Clinical Tables
  const hpoCacheKey = `hpo:${term}`
  let hpoData = await getCached('hpo', hpoCacheKey)
  if (!hpoData) {
    hpoData = await fetchJson(
      `https://clinicaltables.nlm.nih.gov/api/hpo/v3/search?terms=${encodeURIComponent(term)}`
    )
    if (hpoData) await setCache('hpo', hpoCacheKey, hpoData)
  }
  // Clinical Tables returns [count, codes, null, displayStrings]
  if (Array.isArray(hpoData) && Array.isArray(hpoData[1]) && hpoData[1].length > 0) {
    const first = hpoData[1][0]
    if (typeof first === 'string') result.hpoId = first
  }

  await storeIdentifier(result)
  return result
}

/**
 * Resolve a condition into UMLS CUI, HPO ID, and MONDO ID.
 */
export async function resolveCondition(term: string): Promise<ResolvedIdentifier | null> {
  const stored = await getStoredIdentifier(term, 'condition')
  if (stored) return stored

  // Start with symptom resolution for CUI + HPO
  const base = (await resolveSymptom(term)) ?? { term, type: 'condition', cui: null, hpoId: null }
  const result: ResolvedIdentifier = { ...base, type: 'condition', mondoId: null }

  // OLS4 Mondo lookup
  const mondoCacheKey = `mondo:${term}`
  let mondoData = await getCached('ols4_mondo', mondoCacheKey)
  if (!mondoData) {
    mondoData = await fetchJson(
      `https://www.ebi.ac.uk/ols4/api/search?q=${encodeURIComponent(term)}&ontology=mondo`
    )
    if (mondoData) await setCache('ols4_mondo', mondoCacheKey, mondoData)
  }
  const firstDoc = arr(prop(mondoData, 'response'), 'docs')[0]
  const oboId = str(firstDoc, 'obo_id')
  if (oboId) result.mondoId = oboId

  await storeIdentifier(result)
  return result
}

/**
 * Resolve a drug name into an RxCUI via the RxNorm API.
 */
export async function resolveDrug(term: string): Promise<ResolvedIdentifier | null> {
  const stored = await getStoredIdentifier(term, 'drug')
  if (stored) return stored

  const result: ResolvedIdentifier = { term, type: 'drug', rxcui: null }

  const cacheKey = `rxnorm:${term}`
  let rxData = await getCached('rxnorm', cacheKey)
  if (!rxData) {
    rxData = await fetchJson(
      `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(term)}`
    )
    if (rxData) await setCache('rxnorm', cacheKey, rxData)
  }
  const rxcuis = prop(prop(rxData, 'idGroup'), 'rxnormId')
  if (Array.isArray(rxcuis) && rxcuis.length > 0) {
    const first = rxcuis[0]
    if (typeof first === 'string') result.rxcui = first
  }

  await storeIdentifier(result)
  return result
}

/**
 * Resolve a lab test name/code into a LOINC code via the FHIR LOINC API.
 */
export async function resolveLab(term: string): Promise<ResolvedIdentifier | null> {
  const stored = await getStoredIdentifier(term, 'lab')
  if (stored) return stored

  const result: ResolvedIdentifier = { term, type: 'lab', loincCode: null }

  const cacheKey = `loinc:${term}`
  let loincData = await getCached('loinc', cacheKey)
  if (!loincData) {
    loincData = await fetchJson(
      `https://fhir.loinc.org/CodeSystem/$lookup?system=http://loinc.org&code=${encodeURIComponent(term)}`
    )
    if (loincData) await setCache('loinc', cacheKey, loincData, 30)
  }
  const loincParams = prop(loincData, 'parameter')
  if (Array.isArray(loincParams)) {
    const displayParam = loincParams.find((p) => str(p, 'name') === 'display')
    if (displayParam) result.loincCode = term
  }

  await storeIdentifier(result)
  return result
}

/**
 * Resolve a gene symbol into NCBI Gene ID and UniProt accession.
 */
export async function resolveGene(term: string): Promise<ResolvedIdentifier | null> {
  const stored = await getStoredIdentifier(term, 'gene')
  if (stored) return stored

  const result: ResolvedIdentifier = { term, type: 'gene', geneId: null, uniprotId: null }

  // NCBI Gene search
  const ncbiKey = NCBI_API_KEY ? `&api_key=${NCBI_API_KEY}` : ''
  const geneCacheKey = `ncbi_gene:${term}`
  let geneData = await getCached('ncbi_gene', geneCacheKey)
  if (!geneData) {
    geneData = await fetchJson(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=gene&term=${encodeURIComponent(term)}[gene]+AND+homo+sapiens[orgn]&retmode=json${ncbiKey}`
    )
    if (geneData) await setCache('ncbi_gene', geneCacheKey, geneData)
  }
  const geneIds = prop(prop(geneData, 'esearchresult'), 'idlist')
  if (Array.isArray(geneIds) && geneIds.length > 0) {
    const first = geneIds[0]
    if (typeof first === 'string') result.geneId = first
  }

  // UniProt mapping
  const uniprotCacheKey = `uniprot:${term}`
  let uniprotData = await getCached('uniprot', uniprotCacheKey)
  if (!uniprotData) {
    uniprotData = await fetchJson(
      `https://rest.uniprot.org/uniprotkb/search?query=gene_exact:${encodeURIComponent(term)}+AND+organism_id:9606&format=json&size=1`
    )
    if (uniprotData) await setCache('uniprot', uniprotCacheKey, uniprotData)
  }
  const firstEntry = arr(uniprotData, 'results')[0]
  const accession = str(firstEntry, 'primaryAccession')
  if (accession) {
    result.uniprotId = accession
  }

  await storeIdentifier(result)
  return result
}

/**
 * Read the local health profile and resolve every symptom, condition,
 * medication, and gene listed in it.
 */
export async function resolveAllFromHealthProfile(): Promise<{
  symptoms: ResolvedIdentifier[]
  conditions: ResolvedIdentifier[]
  medications: ResolvedIdentifier[]
  genes: ResolvedIdentifier[]
}> {
  let profile: HealthProfile
  try {
    // Dynamic import of JSON at runtime
    const raw = (await import('@/lib/health-profile.json')).default as Record<string, unknown>
    // Extract and flatten fields from the complex JSON structure
    const diagnoses = raw.diagnoses as Record<string, unknown[]> | undefined
    const meds = raw.medications as Record<string, { name: string }[]> | undefined
    const supps = raw.supplements as { name: string }[] | undefined
    profile = {
      symptoms: ((raw.cardiovascular_events as { symptoms?: string[] })?.symptoms || []),
      conditions: [
        ...((diagnoses?.confirmed || []) as { name: string }[]).map(d => d.name || String(d)),
        ...((diagnoses?.suspected || []) as { name: string }[]).map(d => d.name || String(d)),
      ],
      medications: [
        ...((meds?.completed || []).map(m => m.name || String(m))),
        ...((meds?.as_needed || []).map(m => m.name || String(m))),
        ...((supps || []).map(s => s.name || String(s))),
      ],
      genes: ['HAMP', 'BMP6', 'SLC48A1', 'IL6', 'ESR1', 'HFE', 'SLC40A1', 'JAK2', 'STAT3'],
    }
  } catch {
    console.warn('[identity-resolver] Could not load health-profile.json')
    return { symptoms: [], conditions: [], medications: [], genes: [] }
  }

  const symptoms: ResolvedIdentifier[] = []
  for (const s of profile.symptoms ?? []) {
    const res = await resolveSymptom(s)
    if (res) symptoms.push(res)
  }

  const conditions: ResolvedIdentifier[] = []
  for (const c of profile.conditions ?? []) {
    const res = await resolveCondition(c)
    if (res) conditions.push(res)
  }

  const medications: ResolvedIdentifier[] = []
  for (const m of profile.medications ?? []) {
    const res = await resolveDrug(m)
    if (res) medications.push(res)
  }

  const genes: ResolvedIdentifier[] = []
  for (const g of profile.genes ?? []) {
    const res = await resolveGene(g)
    if (res) genes.push(res)
  }

  return { symptoms, conditions, medications, genes }
}
