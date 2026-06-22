import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { useSettings, useUpdateSettings } from '@/hooks/useSettings'
import type { SettingsFormData } from '@/types/database'

export function SettingsPage() {
  const { data: settings, isLoading } = useSettings()
  const updateMutation = useUpdateSettings()

  const [form, setForm] = useState<SettingsFormData>({
    default_buffer_percentage: 5,
    currency: '£',
    tax_percentage: 20,
    labour_cost_percentage: 0,
    packaging_cost_percentage: 0,
  })

  useEffect(() => {
    if (settings) {
      setForm({
        default_buffer_percentage: settings.default_buffer_percentage,
        currency: settings.currency,
        tax_percentage: settings.tax_percentage,
        labour_cost_percentage: settings.labour_cost_percentage,
        packaging_cost_percentage: settings.packaging_cost_percentage,
      })
    }
  }, [settings])

  if (isLoading) return <PageLoader />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await updateMutation.mutateAsync(form)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Settings
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          Configure global defaults for cost calculations
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Global Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Default Buffer Percentage (%)"
              type="number"
              step="0.1"
              min="0"
              value={form.default_buffer_percentage}
              onChange={(e) =>
                setForm({
                  ...form,
                  default_buffer_percentage:
                    parseFloat(e.target.value) || 0,
                })
              }
            />
            <Input
              label="Currency Symbol"
              value={form.currency}
              onChange={(e) =>
                setForm({ ...form, currency: e.target.value })
              }
              maxLength={3}
            />
            <Input
              label="Tax Percentage (%)"
              type="number"
              step="0.1"
              min="0"
              value={form.tax_percentage}
              onChange={(e) =>
                setForm({
                  ...form,
                  tax_percentage: parseFloat(e.target.value) || 0,
                })
              }
            />
            <Input
              label="Labour Cost Percentage (%)"
              type="number"
              step="0.1"
              min="0"
              value={form.labour_cost_percentage}
              onChange={(e) =>
                setForm({
                  ...form,
                  labour_cost_percentage:
                    parseFloat(e.target.value) || 0,
                })
              }
            />
            <Input
              label="Packaging Cost Percentage (%)"
              type="number"
              step="0.1"
              min="0"
              value={form.packaging_cost_percentage}
              onChange={(e) =>
                setForm({
                  ...form,
                  packaging_cost_percentage:
                    parseFloat(e.target.value) || 0,
                })
              }
            />

            <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
              <h4 className="font-medium text-slate-900 dark:text-slate-100">
                Buffer Status Thresholds
              </h4>
              <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-400">
                <li>
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />{' '}
                  Green: 0% – {(form.default_buffer_percentage * 0.8).toFixed(1)}%
                  (within 80% of buffer)
                </li>
                <li>
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />{' '}
                  Amber: {(form.default_buffer_percentage * 0.8).toFixed(1)}% –{' '}
                  {form.default_buffer_percentage}%
                </li>
                <li>
                  <span className="inline-block h-2 w-2 rounded-full bg-red-500" />{' '}
                  Red: Above {form.default_buffer_percentage}%
                </li>
              </ul>
            </div>

            <Button type="submit" loading={updateMutation.isPending}>
              Save Settings
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
