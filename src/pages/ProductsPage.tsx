import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Pencil, Trash2, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
} from '@/hooks/useProducts'
import { useSettings } from '@/hooks/useSettings'
import type { Product, ProductFormData } from '@/types/database'
import { formatCurrency } from '@/lib/utils'

const emptyForm: ProductFormData = {
  name: '',
  description: '',
  buffer_percentage: 5,
  units_per_batch: 1,
}

function ProductFormDialog({
  open,
  onClose,
  product,
  defaultBuffer,
}: {
  open: boolean
  onClose: () => void
  product?: Product
  defaultBuffer: number
}) {
  const [form, setForm] = useState<ProductFormData>(
    product
      ? {
          name: product.name,
          description: product.description || '',
          buffer_percentage: product.buffer_percentage,
          units_per_batch: product.units_per_batch,
        }
      : { ...emptyForm, buffer_percentage: defaultBuffer }
  )

  const createMutation = useCreateProduct()
  const updateMutation = useUpdateProduct()
  const isEditing = Boolean(product)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isEditing && product) {
      await updateMutation.mutateAsync({ id: product.id, form })
    } else {
      await createMutation.mutateAsync(form)
    }
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEditing ? 'Edit Product' : 'Add Product'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Description
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Buffer %"
            type="number"
            step="0.1"
            min="0"
            value={form.buffer_percentage}
            onChange={(e) =>
              setForm({
                ...form,
                buffer_percentage: parseFloat(e.target.value) || 0,
              })
            }
          />
          <Input
            label="Units per Batch"
            type="number"
            min="1"
            value={form.units_per_batch}
            onChange={(e) =>
              setForm({
                ...form,
                units_per_batch: parseInt(e.target.value) || 1,
              })
            }
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={createMutation.isPending || updateMutation.isPending}
          >
            {isEditing ? 'Save Changes' : 'Add Product'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

export function ProductsPage() {
  const { data: products, isLoading } = useProducts()
  const { data: settings } = useSettings()
  const deleteMutation = useDeleteProduct()
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Product | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<Product | undefined>()

  const currency = settings?.currency ?? '£'
  const defaultBuffer = settings?.default_buffer_percentage ?? 5

  const filtered = (products ?? []).filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Products
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Manage products, recipes, and costs
          </p>
        </div>
        <Button onClick={() => { setEditing(undefined); setFormOpen(true) }}>
          <Plus className="h-4 w-4" />
          Add Product
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-4 text-sm dark:border-slate-600 dark:bg-slate-900"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 ? (
          <p className="col-span-full py-8 text-center text-slate-500">
            No products found
          </p>
        ) : (
          filtered.map((product) => (
            <div
              key={product.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                    {product.name}
                  </h3>
                  {product.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                      {product.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditing(product)
                      setFormOpen(true)
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTarget(product)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <p className="text-sm text-slate-500">Current Cost</p>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(product.current_cost_price, currency)}
                  </p>
                  <p className="text-xs text-slate-400">
                    Buffer: {product.buffer_percentage}%
                  </p>
                </div>
                <Link to={`/products/${product.id}`}>
                  <Button variant="outline" size="sm">
                    View
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      <ProductFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditing(undefined)
        }}
        product={editing}
        defaultBuffer={defaultBuffer}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(undefined)}
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteMutation.mutateAsync(deleteTarget.id)
            setDeleteTarget(undefined)
          }
        }}
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteTarget?.name}"?`}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
