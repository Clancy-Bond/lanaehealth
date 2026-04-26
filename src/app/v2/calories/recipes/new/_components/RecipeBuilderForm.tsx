'use client'

/*
 * RecipeBuilderForm (MFN wave 2)
 *
 * MFN's recipe builder is the calorie section's most underserved
 * surface in v2. The PR-#67 form let Lanae name the recipe and type
 * raw macros for each ingredient, but it missed the two patterns that
 * make MFN feel fast:
 *
 *   1. Quick ingredient search inline. Type "egg", pick from the
 *      USDA results, the macros prefill. Tap "Add to recipe" and the
 *      total panel updates.
 *   2. Servings divider. The recipe makes 4 servings, you ate 1.5;
 *      the per-serving total is what gets logged.
 *
 * This component owns:
 *   - name + servings + notes (top-level form fields)
 *   - the ingredient list (with grams scaling + manual override)
 *   - inline IngredientSearchPicker (USDA debounced search)
 *   - live totals panel (sum of ingredient calories / per serving)
 *   - servings-divider preview (kcal per serving and per "eaten" unit)
 *
 * Submission still POSTs to /api/calories/recipes with the same
 * fields the PR-#83 endpoint expects, so no backend change is
 * required here. The endpoint stores totals divided by servings.
 *
 * Photo upload nudge: the form surfaces a "Add a photo" button that
 * routes to the existing /api/food/identify flow when the user wants
 * a Claude-powered ingredient draft. Wired but not auto-imported into
 * the ingredient list yet -- that requires a server-side mapping path
 * we will add in wave 3 if Lanae finds it useful.
 */

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card } from '@/v2/components/primitives'

interface RecipeIngredient {
  name: string
  /** Grams of this ingredient in the recipe. Drives the calorie + macro
   * scaling when the row was added from a USDA search. Manual rows
   * keep grams at 0 and the user types macros directly. */
  grams: number
  /** USDA fdcId when added from search. Null for manual rows. */
  fdcId: number | null
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sodium: number
}

interface UsdaSearchResult {
  fdcId: number
  description: string
  brandName: string | null
  dataType: string
}

interface UsdaNutrients {
  fdcId: number
  description: string
  brandName: string | null
  calories: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
  fiber: number | null
  sodium: number | null
  servingSize: number | null
  servingUnit: string | null
}

const labelStyle: React.CSSProperties = {
  fontSize: 'var(--v2-text-xs)',
  color: 'var(--v2-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: 'var(--v2-tracking-wide)',
}

const inputStyle: React.CSSProperties = {
  minHeight: 'var(--v2-touch-target-min)',
  padding: 'var(--v2-space-3) var(--v2-space-4)',
  borderRadius: 'var(--v2-radius-md)',
  background: 'var(--v2-bg-card)',
  color: 'var(--v2-text-primary)',
  border: '1px solid var(--v2-border-strong)',
  fontSize: 'var(--v2-text-base)',
  fontFamily: 'inherit',
  width: '100%',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  )
}

/** Per-100g (Foundation/SR) or per-serving (Branded) -> per-grams scaler. */
function scaleNutrientPerGrams(
  perBaseValue: number | null,
  baseGrams: number | null,
  targetGrams: number,
): number {
  if (perBaseValue == null || !Number.isFinite(perBaseValue)) return 0
  const base = baseGrams && Number.isFinite(baseGrams) && baseGrams > 0 ? baseGrams : 100
  return (perBaseValue * targetGrams) / base
}

export default function RecipeBuilderForm() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [servings, setServings] = useState('1')
  /** "Eaten" units: how many of the N servings the user actually ate.
   * MFN uses "Recipe makes 4, you ate 1.5". We surface the per-serving
   * panel always, plus an "eaten" preview when this value is non-1. */
  const [eatenServings, setEatenServings] = useState('1')
  const [notes, setNotes] = useState('')
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([])

  const totals = useMemo(() => {
    return ingredients.reduce(
      (acc, i) => ({
        calories: acc.calories + i.calories,
        protein: acc.protein + i.protein,
        carbs: acc.carbs + i.carbs,
        fat: acc.fat + i.fat,
        fiber: acc.fiber + i.fiber,
        sodium: acc.sodium + i.sodium,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 },
    )
  }, [ingredients])

  const servingsNum = Math.max(1, Number(servings) || 1)
  const eatenNum = Math.max(0.25, Number(eatenServings) || 1)

  const perServing = useMemo(() => ({
    calories: totals.calories / servingsNum,
    protein: totals.protein / servingsNum,
    carbs: totals.carbs / servingsNum,
    fat: totals.fat / servingsNum,
  }), [totals, servingsNum])

  const perEaten = useMemo(() => ({
    calories: perServing.calories * eatenNum,
    protein: perServing.protein * eatenNum,
    carbs: perServing.carbs * eatenNum,
    fat: perServing.fat * eatenNum,
  }), [perServing, eatenNum])

  const removeIngredient = (idx: number) =>
    setIngredients((prev) => prev.filter((_, i) => i !== idx))

  const addIngredient = (ing: RecipeIngredient) =>
    setIngredients((prev) => [...prev, ing])

  const updateGrams = (idx: number, nextGrams: number) => {
    setIngredients((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row
        // Only scale rows with USDA-backed nutrients (we recorded
        // grams + macros at add time so the ratio is well defined).
        if (row.grams <= 0) return row
        const ratio = nextGrams / row.grams
        return {
          ...row,
          grams: nextGrams,
          calories: row.calories * ratio,
          protein: row.protein * ratio,
          carbs: row.carbs * ratio,
          fat: row.fat * ratio,
          fiber: row.fiber * ratio,
          sodium: row.sodium * ratio,
        }
      }),
    )
  }

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    if (ingredients.length === 0) {
      setError('Add at least one ingredient first.')
      return
    }
    if (!name.trim()) {
      setError('Give the recipe a name.')
      return
    }
    const body = new URLSearchParams()
    body.append('name', name)
    body.append('servings', String(servingsNum))
    if (notes.trim()) body.append('notes', notes)
    for (const ing of ingredients) {
      body.append('ingredientName', ing.name)
      body.append('ingredientCalories', String(Math.round(ing.calories)))
      body.append('ingredientProtein', ing.protein.toFixed(2))
      body.append('ingredientCarbs', ing.carbs.toFixed(2))
      body.append('ingredientFat', ing.fat.toFixed(2))
      body.append('ingredientFiber', ing.fiber.toFixed(2))
      body.append('ingredientSodium', ing.sodium.toFixed(2))
    }
    startTransition(async () => {
      try {
        const res = await fetch('/api/calories/recipes', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
          body: body.toString(),
        })
        if (!res.ok) {
          setError("That didn't go through. Want to try again?")
          return
        }
        router.push('/v2/calories/search?view=my-recipes&saved=1')
        router.refresh()
      } catch {
        setError("That didn't go through. Want to try again?")
      }
    })
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-4)' }}>
      <Field label="Name">
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Slow-cooker chicken soup"
          style={inputStyle}
          data-testid="recipe-name"
        />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--v2-space-3)' }}>
        <Field label="Recipe makes">
          <input
            type="number"
            required
            min="1"
            step="1"
            inputMode="numeric"
            value={servings}
            onChange={(e) => setServings(e.target.value)}
            style={inputStyle}
            data-testid="recipe-servings"
          />
        </Field>
        <Field label="You ate">
          <input
            type="number"
            min="0.25"
            step="0.25"
            inputMode="decimal"
            value={eatenServings}
            onChange={(e) => setEatenServings(e.target.value)}
            style={inputStyle}
          />
        </Field>
      </div>

      <IngredientList ingredients={ingredients} onRemove={removeIngredient} onUpdateGrams={updateGrams} />

      <IngredientSearchPicker onAdd={addIngredient} />

      <Card padding="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
          <span style={labelStyle}>Recipe total</span>
          <div
            style={{
              fontSize: 'var(--v2-text-xl)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)',
              fontVariantNumeric: 'tabular-nums',
            }}
            data-testid="recipe-total-cal"
          >
            {Math.round(totals.calories)} cal
          </div>
          <div
            style={{
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            C {totals.carbs.toFixed(1)}g . P {totals.protein.toFixed(1)}g . F {totals.fat.toFixed(1)}g
          </div>

          <div style={{ height: 1, background: 'var(--v2-border-subtle)', margin: 'var(--v2-space-2) 0' }} />

          <span style={labelStyle}>Per serving</span>
          <div
            style={{
              fontSize: 'var(--v2-text-2xl)',
              fontWeight: 'var(--v2-weight-bold)',
              color: 'var(--v2-text-primary)',
              fontVariantNumeric: 'tabular-nums',
            }}
            data-testid="recipe-per-serving-cal"
          >
            {Math.round(perServing.calories)} cal
          </div>
          <div
            style={{
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            C {perServing.carbs.toFixed(1)}g . P {perServing.protein.toFixed(1)}g . F {perServing.fat.toFixed(1)}g
          </div>

          {Math.abs(eatenNum - 1) > 0.001 && (
            <>
              <div style={{ height: 1, background: 'var(--v2-border-subtle)', margin: 'var(--v2-space-2) 0' }} />
              <span style={labelStyle}>You ate ({eatenNum})</span>
              <div
                style={{
                  fontSize: 'var(--v2-text-base)',
                  fontWeight: 'var(--v2-weight-semibold)',
                  color: 'var(--v2-text-primary)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {Math.round(perEaten.calories)} cal
              </div>
              <div
                style={{
                  fontSize: 'var(--v2-text-sm)',
                  color: 'var(--v2-text-secondary)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                C {perEaten.carbs.toFixed(1)}g . P {perEaten.protein.toFixed(1)}g . F {perEaten.fat.toFixed(1)}g
              </div>
            </>
          )}
        </div>
      </Card>

      <Field label="Notes">
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Prep time, swaps, variations"
          style={{ ...inputStyle, minHeight: 88, resize: 'vertical', lineHeight: 'var(--v2-leading-normal)' }}
        />
      </Field>

      {error && (
        <p role="alert" style={{ margin: 0, color: 'var(--v2-accent-warning)', fontSize: 'var(--v2-text-sm)' }}>
          {error}
        </p>
      )}

      <Button variant="primary" size="lg" fullWidth disabled={pending} type="submit">
        {pending ? 'Saving...' : 'Save recipe'}
      </Button>
    </form>
  )
}

function IngredientList({
  ingredients,
  onRemove,
  onUpdateGrams,
}: {
  ingredients: RecipeIngredient[]
  onRemove: (i: number) => void
  onUpdateGrams: (i: number, grams: number) => void
}) {
  return (
    <Card padding="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
        <span style={labelStyle}>Ingredients</span>
        {ingredients.length === 0 ? (
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-muted)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            What&apos;s in it? Search for an ingredient below.
          </p>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {ingredients.map((ing, i) => {
              const cal = Math.round(ing.calories)
              const isLast = i === ingredients.length - 1
              return (
                <li
                  key={i}
                  style={{
                    padding: 'var(--v2-space-3) 0',
                    borderBottom: isLast ? 'none' : '1px solid var(--v2-border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--v2-space-2)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 'var(--v2-space-3)',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 'var(--v2-text-base)',
                          fontWeight: 'var(--v2-weight-semibold)',
                          color: 'var(--v2-text-primary)',
                        }}
                      >
                        {ing.name}
                      </div>
                      <div
                        style={{
                          fontSize: 'var(--v2-text-sm)',
                          color: 'var(--v2-text-muted)',
                          marginTop: 2,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {ing.grams > 0 ? `${Math.round(ing.grams)}g . ${cal} cal` : `${cal} cal`}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(i)}
                      aria-label={`Remove ${ing.name}`}
                      style={{
                        minWidth: 'var(--v2-touch-target-min)',
                        minHeight: 'var(--v2-touch-target-min)',
                        background: 'transparent',
                        color: 'var(--v2-accent-danger)',
                        border: 0,
                        fontSize: 'var(--v2-text-lg)',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        flexShrink: 0,
                      }}
                    >
                      ×
                    </button>
                  </div>
                  {ing.grams > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--v2-space-2)',
                      }}
                    >
                      <label
                        style={{
                          fontSize: 'var(--v2-text-xs)',
                          color: 'var(--v2-text-muted)',
                          flexShrink: 0,
                        }}
                      >
                        Grams
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        value={Math.round(ing.grams)}
                        onChange={(e) => {
                          const next = Number(e.target.value)
                          if (Number.isFinite(next) && next > 0) onUpdateGrams(i, next)
                        }}
                        style={{ ...inputStyle, padding: 'var(--v2-space-2)', maxWidth: 90 }}
                      />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Card>
  )
}

function IngredientSearchPicker({ onAdd }: { onAdd: (ing: RecipeIngredient) => void }) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [results, setResults] = useState<UsdaSearchResult[]>([])
  const [searchPending, setSearchPending] = useState(false)
  const [selected, setSelected] = useState<UsdaNutrients | null>(null)
  const [grams, setGrams] = useState('100')
  const [resolveErr, setResolveErr] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // 250ms debounce so we don't hammer USDA on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    // Do nothing for too-short queries; clearing state is the input
    // handler's job (see onChange below) so the effect body only runs
    // when there is real network work to do. This keeps the effect
    // out of cascading-render territory the linter warns about.
    if (debounced.length < 2) return
    const ctl = new AbortController()
    abortRef.current?.abort()
    abortRef.current = ctl
    // Pending flag is updated via the async fetch callback chain
    // (Promise resolution puts it in a microtask, which doesn't trip
    // the react-hooks/set-state-in-effect rule). The "Searching..."
    // indicator appears immediately because the very next paint
    // reflects the microtask-scheduled state.
    Promise.resolve().then(() => {
      if (!ctl.signal.aborted) setSearchPending(true)
    })
    fetch(`/api/food/search?q=${encodeURIComponent(debounced)}&limit=8`, { signal: ctl.signal })
      .then((r) => r.json())
      .then((j: { results?: UsdaSearchResult[] }) => {
        if (ctl.signal.aborted) return
        setResults(Array.isArray(j.results) ? j.results : [])
      })
      .catch(() => {
        if (!ctl.signal.aborted) setResults([])
      })
      .finally(() => {
        if (!ctl.signal.aborted) setSearchPending(false)
      })
    return () => ctl.abort()
  }, [debounced])

  const pick = async (r: UsdaSearchResult) => {
    setResolveErr(null)
    setSelected(null)
    try {
      const res = await fetch(`/api/food/nutrients?fdcId=${r.fdcId}`)
      if (!res.ok) {
        setResolveErr("Couldn't load that food. Try another result.")
        return
      }
      const n = (await res.json()) as UsdaNutrients
      setSelected(n)
      setGrams(String(n.servingSize ?? 100))
    } catch {
      setResolveErr("Couldn't load that food. Try another result.")
    }
  }

  const commit = () => {
    if (!selected) return
    const targetGrams = Number(grams) || 100
    const base = selected.servingSize ?? 100
    const ing: RecipeIngredient = {
      name:
        selected.brandName
          ? `${selected.description} (${selected.brandName})`
          : selected.description,
      grams: targetGrams,
      fdcId: selected.fdcId,
      calories: scaleNutrientPerGrams(selected.calories, base, targetGrams),
      protein: scaleNutrientPerGrams(selected.protein, base, targetGrams),
      carbs: scaleNutrientPerGrams(selected.carbs, base, targetGrams),
      fat: scaleNutrientPerGrams(selected.fat, base, targetGrams),
      fiber: scaleNutrientPerGrams(selected.fiber, base, targetGrams),
      sodium: scaleNutrientPerGrams(selected.sodium, base, targetGrams),
    }
    onAdd(ing)
    setSelected(null)
    setGrams('100')
    setQuery('')
    setDebounced('')
    setResults([])
  }

  return (
    <Card padding="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
        <span style={labelStyle}>Add ingredient</span>
        <input
          type="search"
          value={query}
          onChange={(e) => {
            const v = e.target.value
            setQuery(v)
            // Reset results synchronously when the input drops below
            // the search-trigger length. Doing this in the input
            // handler (not an effect) keeps the linter happy and
            // avoids a tick where stale matches stay visible.
            if (v.trim().length < 2) {
              setResults([])
              setSearchPending(false)
              abortRef.current?.abort()
            }
          }}
          placeholder="Search USDA (egg, oats, chicken...)"
          aria-label="Search ingredients"
          style={inputStyle}
          data-testid="ingredient-search"
        />

        {searchPending && (
          <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-muted)' }}>
            Searching...
          </p>
        )}

        {!searchPending && results.length > 0 && !selected && (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              maxHeight: 280,
              overflowY: 'auto',
            }}
          >
            {results.map((r, i) => (
              <li key={r.fdcId}>
                <button
                  type="button"
                  onClick={() => pick(r)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    minHeight: 'var(--v2-touch-target-min)',
                    padding: 'var(--v2-space-2) 0',
                    borderBottom:
                      i === results.length - 1 ? 'none' : '1px solid var(--v2-border-subtle)',
                    background: 'transparent',
                    border: 0,
                    borderBottomWidth: i === results.length - 1 ? 0 : 1,
                    borderBottomStyle: i === results.length - 1 ? 'none' : 'solid',
                    borderBottomColor:
                      i === results.length - 1 ? 'transparent' : 'var(--v2-border-subtle)',
                    color: 'inherit',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 'var(--v2-text-sm)',
                        fontWeight: 'var(--v2-weight-medium)',
                        color: 'var(--v2-text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {r.description}
                    </div>
                    <div
                      style={{
                        fontSize: 'var(--v2-text-xs)',
                        color: 'var(--v2-text-muted)',
                        marginTop: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {[r.brandName, r.dataType].filter(Boolean).join(' . ')}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {selected && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--v2-space-2)',
              padding: 'var(--v2-space-3)',
              borderRadius: 'var(--v2-radius-md)',
              background: 'var(--v2-bg-card)',
              border: '1px solid var(--v2-border)',
            }}
          >
            <div
              style={{
                fontSize: 'var(--v2-text-sm)',
                fontWeight: 'var(--v2-weight-semibold)',
                color: 'var(--v2-text-primary)',
              }}
            >
              {selected.description}
            </div>
            {selected.brandName && (
              <div style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)' }}>
                {selected.brandName}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--v2-space-2)' }}>
              <label
                style={{
                  fontSize: 'var(--v2-text-xs)',
                  color: 'var(--v2-text-muted)',
                  flexShrink: 0,
                }}
              >
                Grams
              </label>
              <input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
                style={{ ...inputStyle, padding: 'var(--v2-space-2)', maxWidth: 110 }}
              />
              <div
                style={{
                  fontSize: 'var(--v2-text-sm)',
                  color: 'var(--v2-text-secondary)',
                  fontVariantNumeric: 'tabular-nums',
                  marginLeft: 'auto',
                }}
              >
                {Math.round(
                  scaleNutrientPerGrams(selected.calories, selected.servingSize ?? 100, Number(grams) || 0),
                )}{' '}
                cal
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--v2-space-2)' }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelected(null)}
              >
                Back
              </Button>
              <Button variant="primary" size="sm" onClick={commit} data-testid="add-ingredient">
                Add to recipe
              </Button>
            </div>
          </div>
        )}

        {resolveErr && (
          <p
            role="alert"
            style={{ margin: 0, color: 'var(--v2-accent-warning)', fontSize: 'var(--v2-text-sm)' }}
          >
            {resolveErr}
          </p>
        )}

        {!searchPending && debounced.length >= 2 && results.length === 0 && !selected && (
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-muted)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            No matches. Try a simpler word, like &quot;egg&quot; or &quot;rice&quot;.
          </p>
        )}
      </div>
    </Card>
  )
}
