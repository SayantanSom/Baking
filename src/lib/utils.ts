import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { CostStatus } from '@/types/database'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = '£'): string {
  return `${currency}${amount.toFixed(2)}`
}

export function formatUnitCost(amount: number, currency = '£'): string {
  return `${currency}${amount.toFixed(5)}`
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(date: string): string {
  return new Date(date).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function calculateUnitCost(packCost: number, packSize: number): number {
  if (packSize <= 0) return 0
  return packCost / packSize
}

export function calculatePercentageChange(
  previous: number,
  current: number
): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

export function getCostStatus(
  percentageChange: number,
  bufferPercentage: number
): CostStatus {
  const absChange = Math.abs(percentageChange)
  const amberThreshold = bufferPercentage * 0.8

  if (absChange <= amberThreshold) return 'green'
  if (absChange <= bufferPercentage) return 'amber'
  return 'red'
}

export function getStatusLabel(status: CostStatus): string {
  switch (status) {
    case 'green':
      return 'Within Buffer'
    case 'amber':
      return 'Near Buffer'
    case 'red':
      return 'Over Buffer'
  }
}

export function getStatusColor(status: CostStatus): string {
  switch (status) {
    case 'green':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
    case 'amber':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
    case 'red':
      return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
  }
}
