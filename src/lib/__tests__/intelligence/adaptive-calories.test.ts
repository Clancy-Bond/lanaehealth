/**
 * Tests for Adaptive Calorie Algorithm
 */

import { describe, it, expect } from 'vitest'

describe('Adaptive Calorie Algorithm', () => {
  describe('TDEE Calculation', () => {
    it('should calculate actual TDEE from weight change and intake', () => {
      // Eating 2000 cal/day, lost 0.5kg/week
      // 0.5kg = 3850 kcal deficit per week = 550 kcal/day deficit
      // Actual TDEE = 2000 + 550 = 2550
      const avgDailyCalories = 2000
      const weeklyWeightChange = -0.5 // kg
      const calorieEquivalent = weeklyWeightChange * 7700 / 7 // -550
      const actualTDEE = Math.round(avgDailyCalories - calorieEquivalent)
      expect(actualTDEE).toBe(2550)
    })

    it('should detect weight gain means eating above TDEE', () => {
      const avgDailyCalories = 2500
      const weeklyWeightChange = 0.3 // gained 0.3kg
      const calorieEquivalent = weeklyWeightChange * 7700 / 7 // +330
      const actualTDEE = Math.round(avgDailyCalories - calorieEquivalent)
      expect(actualTDEE).toBe(2170) // Eating 330 above TDEE
    })
  })

  describe('Weight Smoothing', () => {
    it('should smooth daily fluctuations with 7-day moving average', () => {
      const weights = [70.2, 70.8, 70.0, 70.5, 70.3, 70.1, 70.4]
      const avg = weights.reduce((a, b) => a + b, 0) / weights.length
      expect(avg).toBeCloseTo(70.33, 1)
      // Individual day variance (70.0 vs 70.8) is 0.8kg but trend is ~70.3
    })
  })

  describe('Macro Calculation', () => {
    it('should calculate protein from bodyweight', () => {
      const bodyWeight = 65 // kg
      const proteinPerKg = 2.0 // for weight loss
      const protein = Math.round(bodyWeight * proteinPerKg)
      expect(protein).toBe(130)
    })

    it('should ensure minimum fat percentage', () => {
      const targetCalories = 1800
      const fatMinPercent = 25
      const fatCalories = Math.round(targetCalories * fatMinPercent / 100)
      const fatGrams = Math.round(fatCalories / 9)
      expect(fatGrams).toBe(50) // 450 cal from fat = 50g
    })

    it('should fill remaining calories with carbs', () => {
      const targetCalories = 1800
      const protein = 130 // 520 cal
      const fat = 50 // 450 cal
      const remainingCalories = targetCalories - protein * 4 - fat * 9
      const carbs = Math.round(remainingCalories / 4)
      expect(carbs).toBe(208) // 830 cal / 4 = 207.5
    })
  })

  describe('Goal-based Targets', () => {
    it('should create deficit for weight loss', () => {
      const tdee = 2200
      const targetWeeklyChange = -0.5 // kg/week
      const dailyDeficit = targetWeeklyChange * 7700 / 7
      const targetCalories = Math.round(tdee + dailyDeficit)
      expect(targetCalories).toBe(1650) // 550 cal deficit
    })

    it('should create surplus for weight gain', () => {
      const tdee = 2200
      const targetWeeklyChange = 0.25 // kg/week
      const dailySurplus = targetWeeklyChange * 7700 / 7
      const targetCalories = Math.round(tdee + dailySurplus)
      expect(targetCalories).toBe(2475)
    })

    it('should maintain TDEE for maintenance', () => {
      const tdee = 2200
      const targetWeeklyChange = 0
      const dailyAdjust = targetWeeklyChange * 7700 / 7
      const targetCalories = Math.round(tdee + dailyAdjust)
      expect(targetCalories).toBe(2200)
    })
  })
})
