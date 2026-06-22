import { useState, useEffect, Fragment, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Plus, Search, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { ProductVarietyRows } from '@/components/products/ProductVarietyRows'
import {
  useProductsWithVarieties,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
} from '@/hooks/useProducts'
import type { Product, ProductFormData, ProductWithVarieties } from '@/types/database'
import { cn } from '@/lib/utils'

function ProductFormDialog({
  open,
  onClose,
  product,
}: {
  open: boolean
  onClose: () => void
  product?: Product
}) {
  const createMutation = useCreateProduct()
  const updateMutation = useUpdateProduct()
  const isEditing = Boolean(product)

  const { register, handleSubmit, reset } = useForm<ProductFormData>({
    defaultValues: { name: '', description: '', category: '', image_url: '' },
  })

  useEffect(() => {
    if (open) {
      reset(
        product
          ? {
              name: product.name,
              description: product.description || '',
              category: product.category || '',
              image_url: product.image_url || '',
            }
          : { name: '', description: '', category: '', image_url: '' }
      )
    }
  }, [open, product, reset])

  const onSubmit = async (form: ProductFormData) => {
    if (isEditing && product) {
      await updateMutation.mutateAsync({
        id: product.id,
        form,
        version: product.version,
      })
    } else {
      await createMutation.mutateAsync(form)
    }
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} title={isEditing ? 'Edit Product' : 'Add Product'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Name" {...register('name', { required: true })} />
        <Input label="Category" {...register('category')} />
        <div>
          <label className="mb-1.5 block text-sm font-medium">Description</label>
          <textarea {...register('description')} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900" />
        </div>
        <Input label="Image URL" type="url" {...register('image_url')} />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
            {isEditing ? 'Save' : 'Add'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function productMatchesSearch(product: ProductWithVarieties, query: string) {
  if (!query) return true
  const q = query.toLowerCase()
  if (product.name.toLowerCase().includes(q)) return true
  if (product.category?.toLowerCase().includes(q)) return true
  return (product.product_varieties ?? []).some(
    (v) =>
      v.variety_name.toLowerCase().includes(q) ||
      v.size_label?.toLowerCase().includes(q) ||
      v.sku?.toLowerCase().includes(q)
  )
}

export function ProductsPage() {
  const { data: products, isLoading } = useProductsWithVarieties()
  const deleteMutation = useDeleteProduct()
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Product | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<Product | undefined>()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const filtered = useMemo(
    () => (products ?? []).filter((p) => productMatchesSearch(p, search)),
    [products, search]
  )

  useEffect(() => {
    if (!search.trim()) return
    const q = search.toLowerCase()
    setExpanded((prev) => {
      const next = new Set(prev)
      for (const product of products ?? []) {
        const varietyMatch = (product.product_varieties ?? []).some(
          (v) =>
            v.variety_name.toLowerCase().includes(q) ||
            v.size_label?.toLowerCase().includes(q) ||
            v.sku?.toLowerCase().includes(q)
        )
        if (varietyMatch) next.add(product.id)
      }
      return next
    })
  }, [search, products])

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-slate-500">
            Expand a product to manage varieties and catalogue selection
          </p>
        </div>
        <Button onClick={() => { setEditing(undefined); setFormOpen(true) }}>
          <Plus className="h-4 w-4" /> Add Product
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search product, variety, size, SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-4 text-sm dark:border-slate-600 dark:bg-slate-900"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
              <th className="w-10 px-2 py-3" />
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-right">Selling</th>
              <th className="px-4 py-3 text-right">Cost</th>
              <th className="px-4 py-3 text-center">Catalogue</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No products</td></tr>
            ) : (
              filtered.map((product) => {
                const isOpen = expanded.has(product.id)
                const varieties = product.product_varieties ?? []
                const catalogueCount = varieties.filter((v) => v.is_catalogue_visible).length

                return (
                  <Fragment key={product.id}>
                    <tr
                      className={cn(
                        'border-b border-slate-100 dark:border-slate-800',
                        isOpen && 'bg-white dark:bg-slate-900'
                      )}
                    >
                      <td className="px-2 py-3">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(product.id)}
                          className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                          aria-expanded={isOpen}
                          aria-label={isOpen ? 'Collapse varieties' : 'Expand varieties'}
                        >
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(product.id)}
                          className="text-left font-semibold text-slate-900 hover:text-emerald-700 dark:text-slate-100"
                        >
                          {product.name}
                          <span className="ml-1.5 font-normal text-slate-500">
                            ({varieties.length})
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{product.category || '—'}</td>
                      <td className="px-4 py-3 text-right">—</td>
                      <td className="px-4 py-3 text-right">—</td>
                      <td className="px-4 py-3 text-center text-slate-600">
                        {catalogueCount > 0 ? (
                          <span title="Varieties in catalogue">{catalogueCount}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Link to={`/products/${product.id}`}>
                            <Button variant="outline" size="sm">
                              Manage
                            </Button>
                          </Link>
                          <Button variant="ghost" size="sm" onClick={() => { setEditing(product); setFormOpen(true) }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(product)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <ProductVarietyRows
                        productId={product.id}
                        varieties={varieties}
                      />
                    )}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-slate-500">
        Tick catalogue checkboxes to include varieties in PDF exports from the Dashboard.
      </p>

      <ProductFormDialog open={formOpen} onClose={() => { setFormOpen(false); setEditing(undefined) }} product={editing} />

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
        message={`Delete "${deleteTarget?.name}" and all varieties?`}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
