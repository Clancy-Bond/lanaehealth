import { getCached, setCache } from './cache'
import { arr, asArray, prop, str } from './_safe-access'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdverseEventCount {
  term: string
  count: number
}

interface DrugInteraction {
  description: string
  severity?: string
  drugs: string[]
}

interface DrugTarget {
  targetId: string
  targetName: string
  mechanismOfAction: string
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the top adverse event reactions reported for a drug from the openFDA
 * drug adverse event endpoint. Returns a ranked list of reaction terms.
 */
export async function getOpenFDAAdverseEvents(
  drugName: string
): Promise<AdverseEventCount[]> {
  const cacheKey = `openfda_events:${drugName.toLowerCase()}`
  const cached = await getCached('openfda', cacheKey)
  if (cached) return cached as AdverseEventCount[]

  try {
    const search = encodeURIComponent(
      `patient.drug.openfda.generic_name:"${drugName}"`
    )
    const url = `https://api.fda.gov/drug/event.json?search=${search}&count=patient.reaction.reactionmeddrapt.exact&limit=10`
    const res = await fetch(url)
    if (!res.ok) return []
    const data: unknown = await res.json()
    const results: AdverseEventCount[] = arr(data, 'results').map((r) => {
      const count = prop(r, 'count')
      return {
        term: str(r, 'term'),
        count: typeof count === 'number' ? count : 0,
      }
    })
    await setCache('openfda', cacheKey, results)
    return results
  } catch (err) {
    console.warn('[medication] openFDA adverse events request failed:', err)
    return []
  }
}

/**
 * Check for known drug-drug interactions using the RxNorm interaction API.
 */
export async function getRxNormInteractions(
  rxcuis: string[]
): Promise<DrugInteraction[]> {
  if (rxcuis.length < 2) return []

  const key = rxcuis.sort().join('+')
  const cacheKey = `rxnorm_interactions:${key}`
  const cached = await getCached('rxnorm_interactions', cacheKey)
  if (cached) return cached as DrugInteraction[]

  try {
    const res = await fetch(
      `https://rxnav.nlm.nih.gov/REST/interaction/list.json?rxcuis=${key}`
    )
    if (!res.ok) return []
    const data: unknown = await res.json()

    const interactions: DrugInteraction[] = []
    const groups = arr(data, 'fullInteractionTypeGroup')
    for (const group of groups) {
      for (const iType of arr(group, 'fullInteractionType')) {
        for (const pair of arr(iType, 'interactionPair')) {
          const severity = prop(pair, 'severity')
          interactions.push({
            description: str(pair, 'description'),
            severity: typeof severity === 'string' ? severity : undefined,
            drugs: arr(pair, 'interactionConcept').map((c) =>
              str(prop(c, 'minConceptItem'), 'name')
            ),
          })
        }
      }
    }

    await setCache('rxnorm_interactions', cacheKey, interactions)
    return interactions
  } catch (err) {
    console.warn('[medication] RxNorm interaction request failed:', err)
    return []
  }
}

/**
 * Query Open Targets GraphQL for drug mechanism of action / targets.
 */
export async function getDrugTargets(drugName: string): Promise<DrugTarget[]> {
  const cacheKey = `opentargets_drug:${drugName.toLowerCase()}`
  const cached = await getCached('opentargets_drug', cacheKey)
  if (cached) return cached as DrugTarget[]

  const query = `
    query DrugMechanism($name: String!) {
      search(queryString: $name, entityNames: ["drug"], page: { size: 1, index: 0 }) {
        hits {
          id
          entity
          object {
            ... on Drug {
              id
              name
              mechanismsOfAction {
                rows {
                  mechanismOfAction
                  targets {
                    id
                    approvedName
                  }
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
      body: JSON.stringify({ query, variables: { name: drugName } }),
    })
    if (!res.ok) return []
    const data: unknown = await res.json()

    const targets: DrugTarget[] = []
    const hits = asArray(prop(prop(prop(data, 'data'), 'search'), 'hits'))
    for (const hit of hits) {
      const moa = prop(prop(hit, 'object'), 'mechanismsOfAction')
      const rows = arr(moa, 'rows')
      for (const row of rows) {
        const moaText = str(row, 'mechanismOfAction')
        for (const t of arr(row, 'targets')) {
          targets.push({
            targetId: str(t, 'id'),
            targetName: str(t, 'approvedName'),
            mechanismOfAction: moaText,
          })
        }
      }
    }

    await setCache('opentargets_drug', cacheKey, targets)
    return targets
  } catch (err) {
    console.warn('[medication] Open Targets drug query failed:', err)
    return []
  }
}
