import type {
  CostStatus,
  ProductVariety,
  ProductVarietyAcceptance,
} from '@/types/database'
import { calculatePercentageChange, getCostStatus } from '@/lib/utils'

export function computeMarginValue(sellingPrice: number, costPrice: number): number {
  return sellingPrice - costPrice
}

export function computeMarginPercentage(
  sellingPrice: number,
  costPrice: number
): number {
  if (sellingPrice <= 0) return 0
  return ((sellingPrice - costPrice) / sellingPrice) * 100
}

export function suggestSellingPriceForTargetMargin(
  costPrice: number,
  targetMarginPct: number
): number {
  if (targetMarginPct >= 100) return costPrice
  const divisor = 1 - targetMarginPct / 100
  if (divisor <= 0) return costPrice
  return costPrice / divisor
}

export function getVarietyCostStatus(
  currentCost: number,
  acceptedCost: number,
  bufferPercentage: number
): { status: CostStatus; changePct: number } {
  const changePct = calculatePercentageChange(acceptedCost, currentCost)
  return {
    status: getCostStatus(changePct, bufferPercentage),
    changePct,
  }
}

export function getVarietyMarginStatus(
  sellingPrice: number,
  currentCost: number,
  acceptance: ProductVarietyAcceptance,
  bufferPercentage: number
): {
  status: CostStatus
  marginValueDelta: number
  marginPpDelta: number
  currentMarginValue: number
  currentMarginPct: number
} {
  const currentMarginValue = computeMarginValue(sellingPrice, currentCost)
  const currentMarginPct = computeMarginPercentage(sellingPrice, currentCost)
  const marginValueDelta = currentMarginValue - acceptance.accepted_margin_value
  const marginPpDelta = currentMarginPct - acceptance.accepted_margin_percentage
  const status = getCostStatus(Math.abs(marginPpDelta), bufferPercentage)

  return {
    status,
    marginValueDelta,
    marginPpDelta,
    currentMarginValue,
    currentMarginPct,
  }
}

export function getVarietyReviewStatus(
  variety: ProductVariety,
  acceptance: ProductVarietyAcceptance | null | undefined
): {
  costStatus: CostStatus
  marginStatus: CostStatus
  costChangePct: number
  marginValueDelta: number
  marginPpDelta: number
} | null {
  if (!acceptance) return null

  const buffer = variety.buffer_percentage ?? 5
  const cost = getVarietyCostStatus(
    variety.current_cost_price,
    acceptance.accepted_cost_price,
    buffer
  )
  const margin = getVarietyMarginStatus(
    variety.selling_price,
    variety.current_cost_price,
    acceptance,
    buffer
  )

  return {
    costStatus: cost.status,
    marginStatus: margin.status,
    costChangePct: cost.changePct,
    marginValueDelta: margin.marginValueDelta,
    marginPpDelta: margin.marginPpDelta,
  }
}

export function needsReview(
  costStatus: CostStatus,
  marginStatus: CostStatus
): boolean {
  return (
    costStatus === 'amber' ||
    costStatus === 'red' ||
    marginStatus === 'amber' ||
    marginStatus === 'red'
  )
}
