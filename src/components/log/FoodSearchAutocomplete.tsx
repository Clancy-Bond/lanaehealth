'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { searchFoods, type FoodSearchResult } from '@/lib/food-database'

interface FoodSearchAutocompleteProps {
  onSelect: (food: FoodSearchResult) => void
  placeholder?: string
}

export default function FoodSearchAutocomplete({
  onSelect,
  placeholder = 'Search food database...',
}: FoodSearchAutocompleteProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FoodSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Debounced search
  const handleSearch = useCallback((value: string) => {
    setQuery(value)
    if (timerRef.current) clearTimeout(timerRef.current)

    if (value.trim().length < 2) {
      setResults([])
      setIsOpen(false)
      return
    }

    setIsLoading(true)
    timerRef.current = setTimeout(async () => {
      try {
        const foods = await searchFoods(value, 8)
        setResults(foods)
        setIsOpen(foods.length > 0)
      } catch {
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }, 400)
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleSelect = (food: FoodSearchResult) => {
    onSelect(food)
    setQuery('')
    setResults([])
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border px-3 py-2.5 text-sm pr-8"
          style={{
            background: 'var(--bg-input)',
            borderColor: 'var(--border)',
            color: 'var(--text-primary)',
          }}
        />
        {isLoading && (
          <div
            className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--accent-sage)', borderTopColor: 'transparent' }}
          />
        )}
        {!isLoading && query.length >= 2 && (
          <svg
            className="absolute right-3 top-1/2 -translate-y-1/2"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            style={{ color: 'var(--text-muted)' }}
          >
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
            <line x1="11" y1="11" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </div>

      {/* Dropdown results */}
      {isOpen && results.length > 0 && (
        <div
          className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl border overflow-hidden"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-light)',
            boxShadow: 'var(--shadow-md)',
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          {results.map((food, idx) => (
            <button
              key={`${food.barcode ?? food.name}-${idx}`}
              type="button"
              onClick={() => handleSelect(food)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
              style={{
                borderBottom: idx < results.length - 1 ? '1px solid var(--border-light)' : undefined,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-elevated)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {food.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {food.brand && (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {food.brand}
                    </span>
                  )}
                  {food.calories_per_100g != null && (
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {Math.round(food.calories_per_100g)} cal/100g
                    </span>
                  )}
                </div>
              </div>
              {food.nutriscore_grade && (
                <span
                  className="flex-shrink-0 rounded-md px-1.5 py-0.5 text-xs font-bold uppercase"
                  style={{
                    background:
                      food.nutriscore_grade === 'a' ? 'rgba(107, 191, 89, 0.15)' :
                      food.nutriscore_grade === 'b' ? 'rgba(107, 191, 89, 0.1)' :
                      food.nutriscore_grade === 'c' ? 'rgba(252, 211, 77, 0.15)' :
                      food.nutriscore_grade === 'd' ? 'rgba(249, 115, 22, 0.15)' :
                      'rgba(239, 68, 68, 0.15)',
                    color:
                      food.nutriscore_grade <= 'b' ? 'var(--pain-low)' :
                      food.nutriscore_grade === 'c' ? 'var(--pain-mild)' :
                      'var(--pain-moderate)',
                  }}
                >
                  {food.nutriscore_grade}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
