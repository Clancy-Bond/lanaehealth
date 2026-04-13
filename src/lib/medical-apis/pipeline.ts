// Pipeline Orchestrator - Chains all 34 medical APIs together
// Manages identity resolution, parallel evidence gathering, cross-linking, and AI analysis

import { createServiceClient } from '@/lib/supabase'
import type { PipelineInput, PipelineResult, MedicalIdentifier, AnalysisFinding, InsightCategory } from '@/lib/types'
import { runFullAnalysis } from '@/lib/ai/analyze'
import { computeInputHash } from '@/lib/ai/data-prep'

// Dynamic imports to avoid circular dependencies and allow graceful fallback
async function loadApiClients() {
  const [
    identityResolver,
    diagnostic,
    medication,
    genomics,
    pathways,
    biomarker,
    research,
    nutrition,
  ] = await Promise.allSettled([
    import('./identity-resolver'),
    import('./diagnostic'),
    import('./medication'),
    import('./genomics'),
    import('./pathways'),
    import('./biomarker'),
    import('./research'),
    import('./nutrition'),
  ])

  return {
    identityResolver: identityResolver.status === 'fulfilled' ? identityResolver.value : null,
    diagnostic: diagnostic.status === 'fulfilled' ? diagnostic.value : null,
    medication: medication.status === 'fulfilled' ? medication.value : null,
    genomics: genomics.status === 'fulfilled' ? genomics.value : null,
    pathways: pathways.status === 'fulfilled' ? pathways.value : null,
    biomarker: biomarker.status === 'fulfilled' ? biomarker.value : null,
    research: research.status === 'fulfilled' ? research.value : null,
    nutrition: nutrition.status === 'fulfilled' ? nutrition.value : null,
  }
}

/**
 * Run the full diagnostic pipeline.
 *
 * Phase 1: Identity Resolution (map terms to standard IDs)
 * Phase 2: Parallel Evidence Gathering (9 API branches)
 * Phase 3: Cross-linking (connect evidence across APIs)
 * Phase 4: AI Reasoning (Claude analyzes combined evidence)
 * Phase 5: Persist (save findings to Supabase)
 */
export async function runFullPipeline(input: PipelineInput): Promise<PipelineResult> {
  const startTime = Date.now()
  const errors: string[] = []
  const apiEvidence: Record<string, unknown> = {}

  const clients = await loadApiClients()

  // ── Phase 1: Identity Resolution ──────────────────────────────────
  console.log('[Pipeline] Phase 1: Identity Resolution')
  let identifiers: MedicalIdentifier[] = input.medicalIdentifiers || []

  if (identifiers.length === 0 && clients.identityResolver) {
    try {
      await clients.identityResolver.resolveAllFromHealthProfile()
      // Reload identifiers from DB
      const supabase = createServiceClient()
      const { data } = await supabase.from('medical_identifiers').select('*')
      identifiers = (data || []) as MedicalIdentifier[]
    } catch (err) {
      errors.push(`Identity resolution failed: ${err}`)
    }
  }

  // Extract key identifiers for downstream queries
  const symptomCuis = identifiers
    .filter(i => i.term_type === 'symptom' && i.umls_cui)
    .map(i => ({ term: i.term, cui: i.umls_cui! }))

  const conditionCuis = identifiers
    .filter(i => i.term_type === 'condition' && i.umls_cui)
    .map(i => ({ term: i.term, cui: i.umls_cui!, mondo: i.mondo_id, hpo: i.hpo_id, efo: i.efo_id }))

  const drugRxcuis = identifiers
    .filter(i => i.term_type === 'drug' && i.rxcui)
    .map(i => ({ term: i.term, rxcui: i.rxcui! }))

  const geneIds = identifiers
    .filter(i => i.term_type === 'gene')
    .map(i => ({ symbol: i.term, ncbiId: i.ncbi_gene_id, uniprotId: i.uniprot_id }))

  const hpoIds = identifiers
    .filter(i => i.hpo_id)
    .map(i => i.hpo_id!)

  // ── Phase 2: Parallel Evidence Gathering ──────────────────────────
  console.log('[Pipeline] Phase 2: Parallel Evidence Gathering (9 branches)')

  const [
    branchA, // Diagnostic: Infermedica + HPO + Monarch
    branchB, // Medication: OpenFDA + RxNorm
    branchC, // Genomics: DisGeNET + Open Targets + STRING
    branchD, // Pathways: KEGG + Reactome
    branchE, // Research: PubMed
    branchF, // Trials: ClinicalTrials.gov
    branchG, // Nutrition: USDA for top foods
    branchH, // Biomarker: CTD chemical-gene-disease
    branchI, // Endo-specific: EndometDB
  ] = await Promise.allSettled([
    // Branch A: Differential diagnosis
    (async () => {
      if (!clients.diagnostic) return null
      const results: Record<string, unknown> = {}

      // HPO disease associations
      if (hpoIds.length > 0) {
        results.hpoAssociations = await clients.diagnostic.getHPODiseaseAssociations(hpoIds.slice(0, 10))
      }

      // Monarch phenotype matching
      if (hpoIds.length > 0) {
        results.monarchMatch = await clients.diagnostic.getMonarchPhenotypeMatch(hpoIds.slice(0, 10))
      }

      // Infermedica (if credentials available)
      if (process.env.INFERMEDICA_APP_ID) {
        // Map top symptoms to Infermedica format
        const topSymptoms = (input.symptoms || [])
          .reduce((acc, s) => {
            acc[s.symptom] = (acc[s.symptom] || 0) + 1
            return acc
          }, {} as Record<string, number>)
        const sorted = Object.entries(topSymptoms).sort((a, b) => b[1] - a[1]).slice(0, 15)

        results.infermedica = await clients.diagnostic.getInfermedicaDiagnosis(
          sorted.map(([symptom]) => ({ id: symptom, choice_id: 'present' })),
          24,
          'female'
        )
      }

      return results
    })(),

    // Branch B: Medication safety
    (async () => {
      if (!clients.medication) return null
      const results: Record<string, unknown> = {}

      // OpenFDA adverse events for each medication
      const medications = ['iron', 'vitamin d', 'midol', 'turmeric', 'omega-3']
      const adverseEvents = await Promise.allSettled(
        medications.map(drug => clients.medication!.getOpenFDAAdverseEvents(drug))
      )
      results.adverseEvents = medications.map((drug, i) => ({
        drug,
        events: adverseEvents[i].status === 'fulfilled' ? adverseEvents[i].value : null,
      }))

      // RxNorm interactions
      if (drugRxcuis.length > 0) {
        results.interactions = await clients.medication.getRxNormInteractions(
          drugRxcuis.map(d => d.rxcui)
        )
      }

      return results
    })(),

    // Branch C: Genomics
    (async () => {
      if (!clients.genomics) return null
      const results: Record<string, unknown> = {}

      // Key genes from the endo-iron-POTS pathway
      const keyGenes = ['HAMP', 'BMP6', 'SLC48A1', 'IL6', 'ESR1', 'HFE', 'SLC40A1', 'JAK2', 'STAT3']

      // Open Targets for endometriosis
      const endoEfo = conditionCuis.find(c => c.term.toLowerCase().includes('endometriosis'))?.efo
      if (endoEfo) {
        results.openTargetsEndo = await clients.genomics.getOpenTargetsAssociations(endoEfo)
      }

      // STRING protein network
      results.stringNetwork = await clients.genomics.getSTRINGNetwork(keyGenes)

      // DisGeNET for key genes (parallel)
      const disgenetResults = await Promise.allSettled(
        keyGenes.map(gene => clients.genomics!.getDisGeNETAssociations(gene))
      )
      results.disgenet = keyGenes.map((gene, i) => ({
        gene,
        associations: disgenetResults[i].status === 'fulfilled' ? disgenetResults[i].value : null,
      }))

      return results
    })(),

    // Branch D: Pathways
    (async () => {
      if (!clients.pathways) return null
      const results: Record<string, unknown> = {}

      // Key KEGG pathways
      const pathwayIds = ['hsa04066', 'hsa04630', 'hsa04978'] // HIF-1, JAK-STAT, mineral absorption
      const keggResults = await Promise.allSettled(
        pathwayIds.map(id => clients.pathways!.getKEGGPathway(id))
      )
      results.kegg = pathwayIds.map((id, i) => ({
        id,
        data: keggResults[i].status === 'fulfilled' ? keggResults[i].value : null,
      }))

      // Reactome enrichment for key gene set
      const keyGenes = ['HAMP', 'BMP6', 'IL6', 'ESR1', 'SLC40A1', 'JAK2', 'STAT3']
      results.reactome = await clients.pathways.getReactomeEnrichment(keyGenes)

      return results
    })(),

    // Branch E: PubMed research
    (async () => {
      if (!clients.research) return null
      const queries = [
        'endometriosis iron deficiency hepcidin',
        'endometriosis inflammation hs-CRP',
        'iron deficiency orthostatic intolerance POTS',
        'endometriosis syncope dysautonomia',
        'ferritin heavy menstrual bleeding endometriosis',
        'hepcidin ferroportin iron sequestration inflammation',
      ]
      const results = await Promise.allSettled(
        queries.map(q => clients.research!.searchPubMed(q, 5))
      )
      return queries.map((q, i) => ({
        query: q,
        papers: results[i].status === 'fulfilled' ? results[i].value : [],
      }))
    })(),

    // Branch F: Clinical trials
    (async () => {
      if (!clients.research) return null
      const conditions = ['endometriosis', 'POTS', 'iron deficiency anemia']
      const results = await Promise.allSettled(
        conditions.map(c => clients.research!.searchClinicalTrials(c, 'Hawaii'))
      )
      return conditions.map((c, i) => ({
        condition: c,
        trials: results[i].status === 'fulfilled' ? results[i].value : [],
      }))
    })(),

    // Branch G: Nutrition (top 50 foods)
    (async () => {
      if (!clients.nutrition) return null
      // Get top logged food items
      const foodCounts: Record<string, number> = {}
      for (const entry of (input.foodEntries || [])) {
        const items = (entry.food_items || '').split(',').map(s => s.trim()).filter(Boolean)
        for (const item of items) {
          foodCounts[item] = (foodCounts[item] || 0) + 1
        }
      }
      const topFoods = Object.entries(foodCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
        .map(([food]) => food)

      if (topFoods.length === 0) return null

      const results = await Promise.allSettled(
        topFoods.map(food => clients.nutrition!.getUSDANutrients(food))
      )
      return topFoods.map((food, i) => ({
        food,
        nutrients: results[i].status === 'fulfilled' ? results[i].value : null,
      }))
    })(),

    // Branch H: CTD chemical-gene-disease
    (async () => {
      if (!clients.biomarker) return null
      const chemicals = ['iron', 'vitamin D', 'turmeric']
      const results = await Promise.allSettled(
        chemicals.map(c => clients.biomarker!.getCTDChemicalGeneDisease(c))
      )
      return chemicals.map((c, i) => ({
        chemical: c,
        data: results[i].status === 'fulfilled' ? results[i].value : null,
      }))
    })(),

    // Branch I: EndometDB
    (async () => {
      if (!clients.pathways) return null
      const genes = ['HAMP', 'IL6', 'ESR1', 'BMP6', 'SLC40A1']
      const results = await Promise.allSettled(
        genes.map(g => clients.pathways!.getEndometDBExpression(g))
      )
      return genes.map((g, i) => ({
        gene: g,
        expression: results[i].status === 'fulfilled' ? results[i].value : null,
      }))
    })(),
  ])

  // Collect evidence from all branches
  const branches = [
    { key: 'diagnostic', result: branchA },
    { key: 'medication', result: branchB },
    { key: 'genomics', result: branchC },
    { key: 'pathways', result: branchD },
    { key: 'research', result: branchE },
    { key: 'trials', result: branchF },
    { key: 'nutrition', result: branchG },
    { key: 'biomarker', result: branchH },
    { key: 'endometdb', result: branchI },
  ]

  for (const { key, result } of branches) {
    if (result.status === 'fulfilled' && result.value) {
      apiEvidence[key] = result.value
    } else if (result.status === 'rejected') {
      errors.push(`Branch ${key} failed: ${result.reason}`)
    }
  }

  // ── Phase 3: Cross-linking ────────────────────────────────────────
  console.log('[Pipeline] Phase 3: Cross-linking evidence')

  // Store gene-disease network entries
  try {
    const supabase = createServiceClient()
    const genomicsData = apiEvidence.genomics as Record<string, unknown> | undefined
    if (genomicsData?.disgenet) {
      const disgenetEntries = (genomicsData.disgenet as { gene: string; associations: unknown }[])
        .filter(d => d.associations)
        .flatMap(d => {
          const assocs = d.associations as { disease_name: string; score: number }[]
          if (!Array.isArray(assocs)) return []
          return assocs.slice(0, 5).map(a => ({
            gene_symbol: d.gene,
            disease_term: a.disease_name || 'unknown',
            association_score: a.score || 0,
            source: 'disgenet' as const,
            pathways: [],
            evidence_json: a,
          }))
        })

      if (disgenetEntries.length > 0) {
        await supabase.from('gene_disease_network').upsert(disgenetEntries, {
          onConflict: 'gene_symbol,disease_term,source',
        }).then(() => {}, () => {}) // Ignore upsert errors (constraint violations OK)
      }
    }
  } catch (err) {
    errors.push(`Cross-linking failed: ${err}`)
  }

  // ── Phase 4: AI Reasoning ─────────────────────────────────────────
  console.log('[Pipeline] Phase 4: AI Reasoning (Claude)')

  const result = await runFullAnalysis(input, apiEvidence)

  // ── Phase 5: Complete ─────────────────────────────────────────────
  console.log(`[Pipeline] Complete in ${Date.now() - startTime}ms`)

  return {
    ...result,
    metadata: {
      ...result.metadata,
      processingTimeMs: Date.now() - startTime,
      errors: [...errors, ...result.metadata.errors],
    },
  }
}
