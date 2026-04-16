// ---------------------------------------------------------------------------
// Research Librarian Persona
// Fourth persona in the analysis pipeline. Searches medical literature,
// evaluates study quality, and connects findings to the patient's hypotheses.
// ---------------------------------------------------------------------------

import type { PersonaDefinition, PersonaResult } from '../persona-runner'
import { runSinglePersona } from '../persona-runner'
import { upsertKBDocument, estimateTokens } from '../knowledge-base'
import type { PersonaHandoff } from '../types'

// ===========================================================================
// Persona Definition
// ===========================================================================

export const RESEARCH_LIBRARIAN_DEFINITION: PersonaDefinition = {
  name: 'research_librarian',
  displayName: 'Research Librarian',
  requiresHandoffFrom: 'challenger',
  systemPrompt: `You are the Research Librarian - a medical literature specialist. Your job is to search and evaluate medical literature to strengthen or weaken the current hypotheses.

RULES:
1. Review the current hypotheses and the challenger's notes
2. For each active hypothesis, identify what medical literature would strengthen or weaken it
3. Search for relevant studies using the provided PubMed results
4. Evaluate each study with a STRUCTURED quality card:

STUDY: [title]
TYPE: [RCT | Cohort | Case-control | Case series | Review | Meta-analysis]
SAMPLE: n=[number]
JOURNAL: [name]
EVIDENCE_GRADE: [A | B | C | D | F]
RELEVANCE: [How this applies to the patient]
HYPOTHESIS_IMPACT: [Supports/Contradicts hypothesis X because...]

Evidence grading scale:
- A: Large RCT or meta-analysis, directly applicable
- B: Smaller RCT, well-designed cohort, or systematic review
- C: Case-control study, moderate quality cohort
- D: Case series, expert opinion, or low-quality study
- F: Fundamentally flawed methodology or irrelevant population

5. Also search for clinical guidelines relevant to the patient's data (e.g., ATA guidelines for TSH management, ACC guidelines for young women with tachycardia)
6. Flag when the challenger suggested missing diagnoses and search for literature supporting those
7. Prioritize studies with larger sample sizes, higher impact journals, and more recent publication dates

OUTPUT FORMAT:
STUDY_CARDS:
[One structured card per study, using the format above]

GUIDELINE_ALERTS:
- [Relevant clinical guidelines and how they apply to the patient]

FINDINGS:
[Summary of literature review results]

DATA_QUALITY:
[Assessment of the quality and relevance of available literature]

DELTA:
[What new evidence was found since last review]

HANDOFF:
Completeness Checker should verify: [specific items to check]`,
}

// ===========================================================================
// searchPubMedForHypotheses
// ===========================================================================

/**
 * Search PubMed for literature related to each hypothesis.
 *
 * For each hypothesis name:
 * 1. Convert to search-friendly terms
 * 2. Call NCBI E-Utilities esearch to get PubMed IDs
 * 3. Fetch abstracts via efetch
 * 4. Return all results as formatted text
 *
 * Limits to 3 results per hypothesis to keep context manageable.
 * Handles fetch errors gracefully, returning partial results.
 */
export async function searchPubMedForHypotheses(
  hypothesisNames: string[],
): Promise<string> {
  const ncbiKey = process.env.NCBI_API_KEY ? `&api_key=${process.env.NCBI_API_KEY}` : ''
  const sections: string[] = []

  for (const name of hypothesisNames) {
    const searchTerms = hypothesisNameToSearchTerms(name)

    try {
      // Step 1: Search for PubMed IDs
      const searchUrl =
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi` +
        `?db=pubmed&retmax=3&retmode=json&term=${encodeURIComponent(searchTerms)}${ncbiKey}`

      const searchRes = await fetch(searchUrl)
      if (!searchRes.ok) {
        sections.push(`<pubmed_${name}>\nSearch failed (HTTP ${searchRes.status})\n</pubmed_${name}>`)
        continue
      }

      const searchData = await searchRes.json()
      const ids: string[] = searchData?.esearchresult?.idlist || []

      if (ids.length === 0) {
        sections.push(`<pubmed_${name}>\nNo results found for: ${searchTerms}\n</pubmed_${name}>`)
        continue
      }

      // Step 2: Fetch abstracts
      const fetchUrl =
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi` +
        `?db=pubmed&id=${ids.join(',')}&rettype=abstract&retmode=text${ncbiKey}`

      const fetchRes = await fetch(fetchUrl)
      if (!fetchRes.ok) {
        sections.push(`<pubmed_${name}>\nAbstract fetch failed (HTTP ${fetchRes.status}). IDs: ${ids.join(', ')}\n</pubmed_${name}>`)
        continue
      }

      const abstractText = await fetchRes.text()
      sections.push(`<pubmed_${name}>\nSearch terms: ${searchTerms}\nResults (${ids.length}):\n\n${abstractText}\n</pubmed_${name}>`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      sections.push(`<pubmed_${name}>\nError: ${message}\n</pubmed_${name}>`)
    }
  }

  if (sections.length === 0) {
    return 'No PubMed searches were performed.'
  }

  return sections.join('\n\n')
}

// ---------------------------------------------------------------------------
// Internal: convert hypothesis name to PubMed search terms
// ---------------------------------------------------------------------------

function hypothesisNameToSearchTerms(name: string): string {
  // Map common hypothesis IDs to clinical search terms
  const termMap: Record<string, string> = {
    pots_dysautonomia: 'POTS dysautonomia diagnosis criteria young women',
    pots: 'postural orthostatic tachycardia syndrome diagnosis',
    hashimotos: 'Hashimoto thyroiditis subclinical hypothyroidism TSH management',
    eds: 'Ehlers-Danlos syndrome hypermobility diagnosis criteria',
    iron_deficiency: 'iron deficiency anemia premenopausal women ferritin threshold',
    endometriosis: 'endometriosis diagnosis management pain',
    mast_cell: 'mast cell activation syndrome diagnosis criteria',
    mcas: 'mast cell activation syndrome diagnosis criteria',
    fibromyalgia: 'fibromyalgia diagnosis criteria young women',
    celiac: 'celiac disease diagnosis screening guidelines',
    sjogrens: 'Sjogren syndrome diagnosis criteria',
    lupus: 'systemic lupus erythematosus diagnosis young women',
    crohns: 'Crohn disease diagnosis criteria',
    gastroparesis: 'gastroparesis diagnosis management',
    small_fiber_neuropathy: 'small fiber neuropathy diagnosis dysautonomia',
  }

  // Check direct match first
  const lower = name.toLowerCase().replace(/[^a-z0-9_]/g, '_')
  if (termMap[lower]) return termMap[lower]

  // Fall back to cleaning up the name into search-friendly terms
  return name
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    + ' diagnosis criteria'
}

// ===========================================================================
// parseStudyCards -- pure function, no DB/API calls
// ===========================================================================

interface StudyCard {
  title: string
  type: string
  sample: string
  journal: string
  evidence_grade: string
  relevance: string
  hypothesis_impact: string
}

const STUDY_CARD_FIELDS = [
  'STUDY',
  'TYPE',
  'SAMPLE',
  'JOURNAL',
  'EVIDENCE_GRADE',
  'RELEVANCE',
  'HYPOTHESIS_IMPACT',
] as const

/**
 * Parse STUDY_CARDS from the raw persona output.
 *
 * Each card starts with "STUDY:" and ends at the next "STUDY:" or
 * a section marker (GUIDELINE_ALERTS, FINDINGS, DATA_QUALITY, DELTA, HANDOFF).
 *
 * Returns an array of parsed study card objects. Missing fields default to ''.
 */
export function parseStudyCards(
  rawOutput: string,
): StudyCard[] {
  // Find the STUDY_CARDS section
  const cardsIdx = rawOutput.indexOf('STUDY_CARDS:')
  if (cardsIdx === -1) return []

  const afterCards = rawOutput.slice(cardsIdx + 'STUDY_CARDS:'.length)

  // Find the end of the STUDY_CARDS section (next major section marker)
  const endMarkers = ['GUIDELINE_ALERTS:', 'FINDINGS:', 'DATA_QUALITY:', 'DELTA:', 'HANDOFF:']
  let endIdx = afterCards.length
  for (const marker of endMarkers) {
    const mIdx = afterCards.indexOf(marker)
    if (mIdx !== -1 && mIdx < endIdx) {
      endIdx = mIdx
    }
  }

  const cardsText = afterCards.slice(0, endIdx)

  // Split into individual card blocks by "STUDY:" marker
  const cardBlocks: string[] = []
  const lines = cardsText.split('\n')
  let currentBlock: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('STUDY:')) {
      // Save previous block if it exists
      if (currentBlock.length > 0) {
        cardBlocks.push(currentBlock.join('\n'))
      }
      currentBlock = [line]
    } else if (currentBlock.length > 0) {
      currentBlock.push(line)
    }
  }

  // Save the last block
  if (currentBlock.length > 0) {
    cardBlocks.push(currentBlock.join('\n'))
  }

  // Parse each block into a StudyCard
  return cardBlocks.map(parseOneCard)
}

/**
 * Parse a single card block into a StudyCard object.
 * Each field line looks like "FIELD_NAME: value text".
 */
function parseOneCard(block: string): StudyCard {
  const card: StudyCard = {
    title: '',
    type: '',
    sample: '',
    journal: '',
    evidence_grade: '',
    relevance: '',
    hypothesis_impact: '',
  }

  const fieldMap: Record<string, keyof StudyCard> = {
    STUDY: 'title',
    TYPE: 'type',
    SAMPLE: 'sample',
    JOURNAL: 'journal',
    EVIDENCE_GRADE: 'evidence_grade',
    RELEVANCE: 'relevance',
    HYPOTHESIS_IMPACT: 'hypothesis_impact',
  }

  const blockLines = block.split('\n')

  for (const line of blockLines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    for (const field of STUDY_CARD_FIELDS) {
      const marker = `${field}:`
      if (trimmed.startsWith(marker)) {
        const value = trimmed.slice(marker.length).trim()
        const cardKey = fieldMap[field]
        if (cardKey) {
          card[cardKey] = value
        }
        break
      }
    }
  }

  return card
}

// ===========================================================================
// runResearchLibrarian
// ===========================================================================

/**
 * Execute the Research Librarian persona:
 * 1. Extract hypothesis names from the tracker content
 * 2. Search PubMed for each hypothesis
 * 3. Build context from challenger handoff + hypothesis tracker + PubMed results
 * 4. Run the persona via runSinglePersona()
 * 5. Parse study cards from the output
 * 6. Upsert KB document: 'research_context' of type 'research'
 * 7. Return result, study cards, and list of KB document IDs updated
 */
export async function runResearchLibrarian(
  challengerHandoff: PersonaHandoff,
  hypothesisTrackerContent: string,
): Promise<{
  result: PersonaResult
  studyCards: StudyCard[]
  kbUpdates: string[]
}> {
  // Step 1: Extract hypothesis names from tracker content
  const hypothesisNames = extractHypothesisNames(hypothesisTrackerContent)

  // Step 2: Search PubMed
  const pubmedResults = await searchPubMedForHypotheses(hypothesisNames)

  // Step 3: Build context
  let fullContext = `<hypothesis_tracker>\n${hypothesisTrackerContent}\n</hypothesis_tracker>\n\n`
  fullContext += `<pubmed_literature>\n${pubmedResults}\n</pubmed_literature>\n\n`

  // Step 4: Run the persona
  const result = await runSinglePersona(
    RESEARCH_LIBRARIAN_DEFINITION,
    fullContext,
    challengerHandoff,
  )

  const kbUpdates: string[] = []
  let studyCards: StudyCard[] = []

  if (result.success && result.rawOutput) {
    // Step 5: Parse study cards
    studyCards = parseStudyCards(result.rawOutput)

    // Step 6: Upsert KB document
    const now = new Date().toISOString()
    const today = now.split('T')[0]

    await upsertKBDocument({
      document_id: 'research_context',
      document_type: 'research',
      title: 'Research Context and Literature',
      content: result.rawOutput,
      version: 1,
      generated_at: now,
      generated_by: 'research_librarian',
      metadata: {
        hypotheses_searched: hypothesisNames,
        study_count: studyCards.length,
        evidence_grades: studyCards.map((c) => c.evidence_grade).filter(Boolean),
      },
      covers_date_start: null,
      covers_date_end: today,
      token_count: estimateTokens(result.rawOutput),
      is_stale: false,
    })
    kbUpdates.push('research_context')

    // Update the result with KB document IDs
    result.documentsUpdated = kbUpdates
  }

  return { result, studyCards, kbUpdates }
}

// ---------------------------------------------------------------------------
// Internal: extract hypothesis names from tracker content
// ---------------------------------------------------------------------------

/**
 * Extract hypothesis names from the hypothesis tracker markdown content.
 * Looks for lines like "### hypothesis_name -- Score:" or similar patterns.
 * Falls back to returning a generic search if no names are found.
 */
function extractHypothesisNames(trackerContent: string): string[] {
  const names: string[] = []
  const lines = trackerContent.split('\n')

  for (const line of lines) {
    // Match patterns like "### hypothesis_name -- Score:" or "### hypothesis_name -"
    const match = line.match(/^###\s+(\S+)\s+--/)
    if (match) {
      names.push(match[1])
    }
  }

  // Fallback: if we found nothing, try a broader search
  if (names.length === 0) {
    // Look for hypothesis_id patterns
    const idMatches = trackerContent.match(/hypothesis[_-]?id[:\s]+["']?(\w+)/gi)
    if (idMatches) {
      for (const m of idMatches) {
        const idMatch = m.match(/["']?(\w+)$/)
        if (idMatch) names.push(idMatch[1])
      }
    }
  }

  return names
}
