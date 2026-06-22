import type { Retailer } from '@/types/database'

const RETAILER_SEARCH_URLS: Record<Retailer, (query: string) => string> = {
  Amazon: (q) =>
    `https://www.amazon.co.uk/s?k=${encodeURIComponent(q)}`,
  "Sainsbury's": (q) =>
    `https://www.sainsburys.co.uk/gol-ui/SearchResults/${encodeURIComponent(q)}`,
  Morrisons: (q) =>
    `https://www.groceries.morrisons.com/search?q=${encodeURIComponent(q)}`,
  Asda: (q) =>
    `https://www.asda.com/groceries/search/${encodeURIComponent(q)}`,
  Tesco: (q) =>
    `https://www.tesco.com/groceries/en-GB/search?query=${encodeURIComponent(q)}`,
  Aldi: (q) =>
    `https://www.aldi.co.uk/results?query=${encodeURIComponent(q)}`,
}

export const RETAILERS: Retailer[] = [
  'Amazon',
  "Sainsbury's",
  'Morrisons',
  'Asda',
  'Tesco',
  'Aldi',
]

export function getRetailerSearchUrl(
  retailer: Retailer,
  ingredientName: string
): string {
  return RETAILER_SEARCH_URLS[retailer](ingredientName)
}

export function openRetailerSearch(
  retailer: Retailer,
  ingredientName: string
): void {
  const url = getRetailerSearchUrl(retailer, ingredientName)
  window.open(url, '_blank', 'noopener,noreferrer')
}
