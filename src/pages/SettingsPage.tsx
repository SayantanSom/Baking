import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { Upload, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { BufferSlider } from '@/components/ui/BufferSlider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import {
  useSettings,
  useUpdateSettings,
  useUpdateCatalogueSettings,
  useCatalogueTemplate,
  useUploadCatalogueTemplate,
  useUpdateCatalogueLayout,
} from '@/hooks/useSettings'
import type {
  SettingsFormData,
  CatalogueSettingsFormData,
  CatalogueLayoutConfig,
} from '@/types/database'
import { DEFAULT_LAYOUT_CONFIG } from '@/types/database'
import { useAuth } from '@/contexts/AuthContext'
import { useSendPasswordReset } from '@/hooks/useAuthActions'

export function SettingsPage() {
  const { user } = useAuth()
  const resetMutation = useSendPasswordReset()
  const { data: settings, isLoading } = useSettings()
  const { data: template } = useCatalogueTemplate()
  const updateMutation = useUpdateSettings()
  const updateCatalogueMutation = useUpdateCatalogueSettings()
  const uploadMutation = useUploadCatalogueTemplate()
  const layoutMutation = useUpdateCatalogueLayout()
  const fileRef = useRef<HTMLInputElement>(null)

  const settingsForm = useForm<SettingsFormData>()
  const catalogueForm = useForm<CatalogueSettingsFormData>()
  const [layout, setLayout] = useState<CatalogueLayoutConfig>(DEFAULT_LAYOUT_CONFIG)
  const defaultBuffer = settingsForm.watch('default_buffer_percentage') ?? settings?.default_buffer_percentage ?? 5

  useEffect(() => {
    if (settings) {
      settingsForm.reset({
        default_buffer_percentage: settings.default_buffer_percentage,
        currency: settings.currency,
        tax_percentage: settings.tax_percentage,
        default_labour_cost: settings.default_labour_cost,
        default_packaging_cost: settings.default_packaging_cost,
      })
      catalogueForm.reset({
        catalogue_title: settings.catalogue_title,
        business_name: settings.business_name,
        footer_text: settings.footer_text,
        show_prices: settings.show_prices,
        show_descriptions: settings.show_descriptions,
        show_images: settings.show_images,
        products_per_page: settings.products_per_page,
      })
    }
  }, [settings, settingsForm, catalogueForm])

  useEffect(() => {
    if (template?.layout_config) {
      setLayout(template.layout_config as CatalogueLayoutConfig)
    }
  }, [template])

  if (isLoading) return <PageLoader />

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await uploadMutation.mutateAsync(file)
  }

  const updateLayoutField = (
    field: keyof CatalogueLayoutConfig,
    key: string,
    value: number | string
  ) => {
    setLayout((prev) => {
      const current = prev[field]
      if (typeof current === 'object' && current !== null) {
        return { ...prev, [field]: { ...current, [key]: value } }
      }
      return { ...prev, [field]: value }
    })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-slate-500">Global defaults and catalogue template</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Account</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-500">
            Signed in as <span className="font-medium text-slate-700 dark:text-slate-300">{user?.email}</span>
          </p>
          <p className="text-sm text-slate-500">
            We&apos;ll email you a secure link to set a new password.
          </p>
          <Button
            variant="outline"
            onClick={() => user?.email && resetMutation.mutate(user.email)}
            loading={resetMutation.isPending}
            disabled={!user?.email}
          >
            <KeyRound className="h-4 w-4" />
            Send password reset email
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Global Settings</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={settingsForm.handleSubmit((f) => updateMutation.mutateAsync(f))} className="space-y-4">
            <BufferSlider
              label="Default variety buffer %"
              value={defaultBuffer}
              onChange={(v) => settingsForm.setValue('default_buffer_percentage', v)}
            />
            <input type="hidden" {...settingsForm.register('default_buffer_percentage', { valueAsNumber: true })} />
            <Input label="Currency" {...settingsForm.register('currency')} maxLength={3} />
            <Input label="Tax %" type="number" step="0.1" {...settingsForm.register('tax_percentage', { valueAsNumber: true })} />
            <Input
              label={`Default Labour Cost (${settings?.currency ?? '£'})`}
              type="number"
              step="0.01"
              {...settingsForm.register('default_labour_cost', { valueAsNumber: true })}
            />
            <Input
              label={`Default Packaging Cost (${settings?.currency ?? '£'})`}
              type="number"
              step="0.01"
              {...settingsForm.register('default_packaging_cost', { valueAsNumber: true })}
            />
            <p className="text-sm text-slate-500">
              Fixed amounts per variety — not percentages. Used as defaults when creating new varieties.
            </p>
            <Button type="submit" loading={updateMutation.isPending}>Save Settings</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Catalogue Template</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={catalogueForm.handleSubmit((f) => updateCatalogueMutation.mutateAsync(f))} className="space-y-4">
            <Input label="Catalogue Title" {...catalogueForm.register('catalogue_title')} />
            <Input label="Business Name" {...catalogueForm.register('business_name')} />
            <Input label="Footer Text" {...catalogueForm.register('footer_text')} />
            <Input label="Products Per Page" type="number" min="1" max="12" {...catalogueForm.register('products_per_page', { valueAsNumber: true })} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...catalogueForm.register('show_prices')} /> Show prices
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...catalogueForm.register('show_descriptions')} /> Show descriptions
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...catalogueForm.register('show_images')} /> Show images
            </label>
            <Button type="submit" loading={updateCatalogueMutation.isPending}>Save Catalogue Settings</Button>
          </form>

          <div className="border-t pt-6">
            <h4 className="mb-3 font-medium">Upload Template Background</h4>
            <p className="mb-3 text-sm text-slate-500">PDF, PNG, or JPG background template</p>
            <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={handleFileUpload} />
            <Button variant="outline" onClick={() => fileRef.current?.click()} loading={uploadMutation.isPending}>
              <Upload className="h-4 w-4" /> Upload Template
            </Button>
            {template?.file_url && (
              <div className="mt-4">
                <p className="text-sm text-slate-500">Current: {template.file_type?.toUpperCase()} template</p>
                {(template.file_type === 'png' || template.file_type === 'jpg') && (
                  <img src={template.file_url} alt="Template preview" className="mt-2 max-h-48 rounded border" />
                )}
              </div>
            )}
          </div>

          <div className="border-t pt-6">
            <h4 className="mb-3 font-medium">Layout Editor</h4>
            <p className="mb-4 text-sm text-slate-500">
              Adjust text positions with input fields. Drag-and-drop positioning can be added later.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {(['productName', 'varietyName', 'price', 'description', 'sku'] as const).map((field) => (
                <div key={field} className="rounded-lg border p-3 dark:border-slate-700">
                  <p className="mb-2 text-sm font-medium capitalize">{field.replace(/([A-Z])/g, ' $1')}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      label="X"
                      type="number"
                      value={layout[field].x}
                      onChange={(e) => updateLayoutField(field, 'x', parseInt(e.target.value) || 0)}
                    />
                    <Input
                      label="Y"
                      type="number"
                      value={layout[field].y}
                      onChange={(e) => updateLayoutField(field, 'y', parseInt(e.target.value) || 0)}
                    />
                    <Input
                      label="Font Size"
                      type="number"
                      value={layout[field].fontSize ?? 12}
                      onChange={(e) => updateLayoutField(field, 'fontSize', parseInt(e.target.value) || 12)}
                    />
                  </div>
                </div>
              ))}
              <div className="rounded-lg border p-3 dark:border-slate-700">
                <p className="mb-2 text-sm font-medium">Image Position</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input label="X" type="number" value={layout.image.x} onChange={(e) => updateLayoutField('image', 'x', parseInt(e.target.value) || 0)} />
                  <Input label="Y" type="number" value={layout.image.y} onChange={(e) => updateLayoutField('image', 'y', parseInt(e.target.value) || 0)} />
                  <Input label="Width" type="number" value={layout.image.width} onChange={(e) => updateLayoutField('image', 'width', parseInt(e.target.value) || 0)} />
                  <Input label="Height" type="number" value={layout.image.height} onChange={(e) => updateLayoutField('image', 'height', parseInt(e.target.value) || 0)} />
                </div>
              </div>
            </div>
            <Input
              label="Item Spacing (Y)"
              type="number"
              className="mt-4 max-w-xs"
              value={layout.itemSpacingY}
              onChange={(e) => setLayout((p) => ({ ...p, itemSpacingY: parseInt(e.target.value) || 180 }))}
            />
            <Button className="mt-4" onClick={() => layoutMutation.mutate(layout)} loading={layoutMutation.isPending}>
              Save Layout
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
