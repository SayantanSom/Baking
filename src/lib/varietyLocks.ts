import type { ProductVariety } from '@/types/database'

export function isPriceLocked(variety: ProductVariety): boolean {
  if (!variety.price_locked_until) return false
  return new Date(variety.price_locked_until) > new Date()
}

export function isCostLocked(variety: ProductVariety): boolean {
  if (!variety.cost_locked_until) return false
  return new Date(variety.cost_locked_until) > new Date()
}

/** Margin erosion % when live cost exceeds locked snapshot during cost lock */
export function getMarginErosionPercent(variety: ProductVariety): number | null {
  if (!isCostLocked(variety)) return null
  const selling =
    variety.locked_selling_price ?? variety.selling_price
  const lockedCost = variety.locked_cost_price
  if (lockedCost == null || selling <= 0) return null

  const lockedMargin = selling - lockedCost
  const currentMargin = selling - variety.current_cost_price
  if (lockedMargin <= 0) return null

  const erosion = ((lockedMargin - currentMargin) / selling) * 100
  return erosion > 0.01 ? erosion : null
}

export function getEffectiveSellingPrice(variety: ProductVariety): number {
  if (isPriceLocked(variety) && variety.locked_selling_price != null) {
    return variety.locked_selling_price
  }
  return variety.selling_price
}
