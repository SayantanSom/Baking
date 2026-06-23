import { Link } from 'react-router-dom'
import { useSetVarietyCatalogueVisibility } from '@/hooks/useProducts'
import { useSettings } from '@/hooks/useSettings'
import type { ProductVariety } from '@/types/database'
import { formatCurrency } from '@/lib/utils'

function varietyLabel(variety: ProductVariety) {
  return [variety.size_label, variety.variety_name].filter(Boolean).join(' ') || variety.variety_name
}

export function ProductVarietyRows({
  productId,
  varieties,
}: {
  productId: string
  varieties: ProductVariety[]
}) {
  const { data: settings } = useSettings()
  const setCatalogue = useSetVarietyCatalogueVisibility()
  const pendingVarietyId = setCatalogue.isPending
    ? setCatalogue.variables?.varietyId
    : undefined
  const currency = settings?.currency ?? '£'

  if (varieties.length === 0) {
    return (
      <tr className="border-b border-border bg-surface-muted/50">
        <td colSpan={7} className="px-4 py-2 pl-12 text-sm text-fg-muted">
          No varieties yet — open Manage to add one
        </td>
      </tr>
    )
  }

  return (
    <>
      {varieties.map((variety) => (
        <tr
          key={variety.id}
          className="border-b border-border bg-surface-muted/50"
        >
          <td className="px-2 py-2" />
          <td className="px-4 py-2 pl-12">
            <Link
              to={`/products/${productId}/varieties/${variety.id}`}
              className="text-accent hover:underline"
            >
              {varietyLabel(variety)}
            </Link>
            {variety.sku && (
              <span className="ml-2 text-xs text-fg-subtle">{variety.sku}</span>
            )}
          </td>
          <td className="px-4 py-2" />
          <td className="px-4 py-2 text-right">
            {formatCurrency(variety.selling_price, currency)}
          </td>
          <td className="px-4 py-2 text-right text-fg-secondary">
            {formatCurrency(variety.current_cost_price, currency)}
          </td>
          <td className="px-4 py-2 text-center">
            <input
              type="checkbox"
              checked={variety.is_catalogue_visible}
              disabled={pendingVarietyId === variety.id}
              onChange={(e) =>
                setCatalogue.mutate({
                  varietyId: variety.id,
                  productId,
                  visible: e.target.checked,
                })
              }
              aria-label={`Include ${varietyLabel(variety)} in catalogue`}
              title="Include in catalogue PDF"
            />
          </td>
          <td className="px-4 py-2" />
        </tr>
      ))}
    </>
  )
}
