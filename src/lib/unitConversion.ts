import type { IngredientUnit } from '@/types/database'

const WEIGHT_UNITS: IngredientUnit[] = ['g', 'kg']
const VOLUME_UNITS: IngredientUnit[] = ['ml', 'l']

export function getUnitFamily(
  unit: IngredientUnit
): 'weight' | 'volume' | 'unit' {
  if (WEIGHT_UNITS.includes(unit)) return 'weight'
  if (VOLUME_UNITS.includes(unit)) return 'volume'
  return 'unit'
}

/** Convert a quantity from one unit into the ingredient's base unit */
export function convertToBaseUnit(
  quantity: number,
  fromUnit: IngredientUnit,
  baseUnit: IngredientUnit
): number {
  if (fromUnit === baseUnit) return quantity

  const fromFamily = getUnitFamily(fromUnit)
  const baseFamily = getUnitFamily(baseUnit)

  if (fromFamily !== baseFamily) {
    throw new Error(`Cannot convert ${fromUnit} to ${baseUnit}`)
  }

  if (fromFamily === 'weight') {
    const toGrams = fromUnit === 'kg' ? quantity * 1000 : quantity
    return baseUnit === 'kg' ? toGrams / 1000 : toGrams
  }

  if (fromFamily === 'volume') {
    const toMl = fromUnit === 'l' ? quantity * 1000 : quantity
    return baseUnit === 'l' ? toMl / 1000 : toMl
  }

  return quantity
}

export function calculateCostPerBaseUnit(
  packCost: number,
  packSize: number,
  packUnit: IngredientUnit,
  baseUnit: IngredientUnit
): number {
  if (packSize <= 0) return 0
  const baseSize = convertToBaseUnit(packSize, packUnit, baseUnit)
  if (baseSize <= 0) return 0
  return packCost / baseSize
}
