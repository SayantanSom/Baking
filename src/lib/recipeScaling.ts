import type { RecipeScalingMode } from '@/types/database'

export function scaleQuantity(
  baseQty: number,
  factor: number,
  scalingMode: RecipeScalingMode
): number {
  if (scalingMode === 'fixed') return baseQty
  return baseQty * factor
}
