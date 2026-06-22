import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { RETAILERS, openRetailerSearch } from '@/services/retailerUrls'

export function RetailerPriceLookup({ ingredientName }: { ingredientName: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">
        Find cost price on retailer
      </p>
      <div className="flex flex-wrap gap-2">
        {RETAILERS.map((retailer) => (
          <Button
            key={retailer}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openRetailerSearch(retailer, ingredientName)}
          >
            <ExternalLink className="h-3 w-3" />
            {retailer}
          </Button>
        ))}
      </div>
    </div>
  )
}
