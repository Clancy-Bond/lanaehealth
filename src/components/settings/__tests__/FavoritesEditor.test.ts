/**
 * Unit tests for the FavoritesEditor reorder helper (Wave 2e F5).
 *
 * The component itself is a React/DOM interaction surface, tested via
 * its only pure dependency: moveItem. The save/add/remove wiring is
 * exercised by the component in dev; here we cover the reorder math
 * so drag-to-reorder bugs surface in CI.
 */
import { describe, it, expect } from 'vitest'
import { __testing } from '@/components/settings/FavoritesEditor'

const { moveItem } = __testing

describe('moveItem', () => {
  it('moves an item from a lower index to a higher one', () => {
    const arr = ['a', 'b', 'c', 'd']
    expect(moveItem(arr, 0, 2)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('moves an item from a higher index to a lower one', () => {
    const arr = ['a', 'b', 'c', 'd']
    expect(moveItem(arr, 3, 0)).toEqual(['d', 'a', 'b', 'c'])
  })

  it('returns the same reference when from === to', () => {
    const arr = ['a', 'b', 'c']
    expect(moveItem(arr, 1, 1)).toBe(arr)
  })

  it('clamps the destination index into [0, length - 1]', () => {
    const arr = ['a', 'b', 'c']
    expect(moveItem(arr, 0, 99)).toEqual(['b', 'c', 'a'])
    expect(moveItem(arr, 2, -5)).toEqual(['c', 'a', 'b'])
  })

  it('returns the input when from is out of range', () => {
    const arr = ['a', 'b', 'c']
    expect(moveItem(arr, -1, 0)).toBe(arr)
    expect(moveItem(arr, 99, 0)).toBe(arr)
  })

  it('preserves array length on any legal move', () => {
    const arr = ['a', 'b', 'c', 'd', 'e']
    for (let from = 0; from < arr.length; from++) {
      for (let to = 0; to < arr.length; to++) {
        expect(moveItem(arr, from, to)).toHaveLength(arr.length)
      }
    }
  })

  it('never mutates the input array', () => {
    const arr = ['a', 'b', 'c']
    const snapshot = [...arr]
    // Runtime freeze guards against in-place mutation; cast keeps the
    // signature mutable because TS's readonly is not observable here.
    Object.freeze(arr)
    moveItem(arr as string[], 0, 2)
    expect(arr).toEqual(snapshot)
  })
})
