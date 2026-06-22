import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import {
  useSupplierPrices,
  useCreateSupplierPrice,
  useDeleteSupplierPrice,
} from '@/hooks/useSettings'
import { RETAILERS } from '@/services/retailerUrls'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { Trash2 } from 'lucide-react'

export function SupplierPriceSection({
  ingredientId,
}: {
  ingredientId: string
}) {
  const { data: prices, isLoading } = useSupplierPrices(ingredientId)
  const createMutation = useCreateSupplierPrice()
  const deleteMutation = useDeleteSupplierPrice()

  const [retailer, setRetailer] = useState(RETAILERS[0])
  const [price, setPrice] = useState('')
  const [packSize, setPackSize] = useState('')
  const [productUrl, setProductUrl] = useState('')

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    await createMutation.mutateAsync({
      ingredientId,
      retailer,
      price: parseFloat(price),
      packSize: parseFloat(packSize),
      productUrl: productUrl || undefined,
    })
    setPrice('')
    setPackSize('')
    setProductUrl('')
  }

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-slate-900 dark:text-slate-100">
        Recorded Supplier Prices
      </h4>

      <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Retailer"
          value={retailer}
          onChange={(e) => setRetailer(e.target.value as typeof retailer)}
          options={RETAILERS.map((r) => ({ value: r, label: r }))}
        />
        <Input
          label="Price (£)"
          type="number"
          step="0.01"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />
        <Input
          label="Pack Size"
          type="number"
          step="0.01"
          min="0.01"
          value={packSize}
          onChange={(e) => setPackSize(e.target.value)}
          required
        />
        <Input
          label="Product URL (optional)"
          type="url"
          value={productUrl}
          onChange={(e) => setProductUrl(e.target.value)}
        />
        <div className="sm:col-span-2">
          <Button type="submit" size="sm" loading={createMutation.isPending}>
            Save Price Record
          </Button>
        </div>
      </form>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : (prices ?? []).length === 0 ? (
        <p className="text-sm text-slate-500">No supplier prices recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {(prices ?? []).map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-700"
            >
              <div>
                <p className="font-medium">{p.retailer}</p>
                <p className="text-sm text-slate-500">
                  {formatCurrency(p.price)} / {p.pack_size} — checked{' '}
                  {formatDateTime(p.checked_at)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteMutation.mutate(p.id)}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
