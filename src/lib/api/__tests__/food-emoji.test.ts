/**
 * Food name -> emoji mapper for search result badges.
 *
 * Keyword list is ordered most-specific first so "egg omelet" matches
 * the omelet entry rather than the generic egg entry. Tests pin a
 * representative sample across categories so future edits to the
 * keyword list don't silently break common matches.
 */
import { describe, it, expect } from 'vitest'
import { emojiForFood } from '../food-emoji'

describe('emojiForFood', () => {
  it('returns null for empty / whitespace input', () => {
    expect(emojiForFood('')).toBeNull()
    expect(emojiForFood('   ')).toBeNull()
  })

  describe('eggs', () => {
    it('matches plain eggs', () => {
      expect(emojiForFood('Eggs, Grade A, Large')).toBe('🥚')
      expect(emojiForFood('egg, raw, whole')).toBe('🥚')
    })
    it('matches omelet variants as cooked', () => {
      expect(emojiForFood('Egg omelet, plain')).toBe('🍳')
      expect(emojiForFood('Egg, scrambled, with milk')).toBe('🍳')
      expect(emojiForFood('Eggs Benedict')).toBe('🍳')
    })
    it('matches egg whites + yolks', () => {
      expect(emojiForFood('Eggs, Grade A, Large, egg white')).toBe('🥚')
      expect(emojiForFood('Egg yolk, raw')).toBe('🥚')
    })
  })

  describe('meat + seafood', () => {
    it('returns the right cuts', () => {
      expect(emojiForFood('Meat beef filet mignon')).toBe('🥩')
      expect(emojiForFood('Beef, top sirloin')).toBe('🥩')
      expect(emojiForFood('Bacon, raw')).toBe('🥓')
      expect(emojiForFood('Chicken breast, roasted')).toBe('🍗')
      expect(emojiForFood('Turkey, ground')).toBe('🦃')
    })
    it('seafood maps to fish/shellfish', () => {
      expect(emojiForFood('Salmon, atlantic')).toBe('🐟')
      expect(emojiForFood('Tuna, yellowfin')).toBe('🐟')
      expect(emojiForFood('Shrimp, cooked')).toBe('🦐')
      expect(emojiForFood('Crab, blue, cooked')).toBe('🦀')
      expect(emojiForFood('Lobster')).toBe('🦞')
    })
  })

  describe('fruit + vegetables', () => {
    it('matches common fruit', () => {
      expect(emojiForFood('Apples, raw, with skin')).toBe('🍎')
      expect(emojiForFood('Bananas, raw')).toBe('🍌')
      expect(emojiForFood('Strawberries, raw')).toBe('🍓')
      expect(emojiForFood('Blueberries, raw')).toBe('🫐')
      expect(emojiForFood('Avocados, raw, all commercial varieties')).toBe('🥑')
    })
    it('matches common vegetables', () => {
      expect(emojiForFood('Broccoli, raw')).toBe('🥦')
      expect(emojiForFood('Carrots, baby, raw')).toBe('🥕')
      expect(emojiForFood('Tomatoes, red, ripe')).toBe('🍅')
      expect(emojiForFood('Lettuce, romaine')).toBe('🥬')
      expect(emojiForFood('Salad, mixed greens')).toBe('🥗')
    })
  })

  describe('grains + bread', () => {
    it('matches bread variants', () => {
      expect(emojiForFood('Bread, whole wheat')).toBe('🍞')
      expect(emojiForFood('Bagels, plain')).toBe('🥯')
      expect(emojiForFood('Croissant, butter')).toBe('🥐')
    })
    it('matches grains', () => {
      expect(emojiForFood('Rice, white, cooked')).toBe('🍚')
      expect(emojiForFood('Pasta, cooked')).toBe('🍝')
      expect(emojiForFood('Oatmeal, instant')).toBe('🥣')
    })
  })

  describe('beverages', () => {
    it('matches drinks', () => {
      expect(emojiForFood('Coffee, brewed')).toBe('☕')
      expect(emojiForFood('Tea, green')).toBe('🍵')
      expect(emojiForFood('Milk, whole')).toBe('🥛')
      expect(emojiForFood('Orange juice')).toBe('🍊') // matches "orange" first
      expect(emojiForFood('Apple juice')).toBe('🍎') // matches "apple" first
    })
  })

  describe('uncategorized falls back to null', () => {
    it('returns null for foods not in the keyword map', () => {
      expect(emojiForFood('Quinoa kasha (zoom)')).toBe('🌾') // matches quinoa
      expect(emojiForFood('Tempeh')).toBeNull()
      expect(emojiForFood('Asafoetida powder')).toBeNull()
      expect(emojiForFood('Xanthan gum')).toBeNull()
    })
  })

  describe('handles tricky names', () => {
    it('does not over-match (e.g. "salt" should not catch "salty snacks")', () => {
      expect(emojiForFood('Salt, table')).toBe('🧂')
      // "Spices, cinnamon" matches /spice/ (the word is present);
      // "Cinnamon, ground" alone does not (and that's intentional --
      // we don't want every spice to match a generic salt-shaker).
      expect(emojiForFood('Spices, cinnamon, ground')).toBe('🧂')
      expect(emojiForFood('Cinnamon, ground')).toBeNull()
    })
    it('respects most-specific-first order', () => {
      // "filet mignon" listed AFTER "beef" but specific enough to still match
      expect(emojiForFood('Filet mignon, broiled')).toBe('🥩')
      // "egg omelet" should match omelet, not generic egg
      expect(emojiForFood('Egg omelet, ham and cheese')).toBe('🍳')
    })
  })
})
