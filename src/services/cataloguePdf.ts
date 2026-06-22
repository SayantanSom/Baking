import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import type {
  CatalogueLayoutConfig,
  CatalogueTemplate,
  DashboardSearchResult,
  UserSettings,
} from '@/types/database'

export interface CatalogueItem {
  productName: string
  varietyName: string
  sizeLabel: string | null
  sellingPrice: number
  description: string | null
  imageUrl: string | null
  sku: string | null
}

export async function generateCataloguePdf(
  items: CatalogueItem[],
  settings: UserSettings,
  template: CatalogueTemplate | null
): Promise<Uint8Array> {
  const layout = template?.layout_config ?? getDefaultLayout()
  const productsPerPage = settings.products_per_page || layout.productsPerPage

  let pdfDoc: PDFDocument

  if (template?.file_url && template.file_type === 'pdf') {
    try {
      const templateBytes = await fetchTemplateBytes(template.file_url)
      pdfDoc = await PDFDocument.load(templateBytes)
    } catch {
      pdfDoc = await PDFDocument.create()
    }
  } else {
    pdfDoc = await PDFDocument.create()
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  let backgroundImage: Awaited<ReturnType<PDFDocument['embedPng']>> | null =
    null
  if (
    template?.file_url &&
    (template.file_type === 'png' || template.file_type === 'jpg')
  ) {
    try {
      const imgBytes = await fetchTemplateBytes(template.file_url)
      backgroundImage =
        template.file_type === 'png'
          ? await pdfDoc.embedPng(imgBytes)
          : await pdfDoc.embedJpg(imgBytes)
    } catch {
      backgroundImage = null
    }
  }

  const pageWidth = 595
  const pageHeight = 842
  const totalPages = Math.max(1, Math.ceil(items.length / productsPerPage))

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
    let page = pdfDoc.getPage(pageIndex)
    if (!page) {
      page = pdfDoc.addPage([pageWidth, pageHeight])
    }

    const { width, height } = page.getSize()

    if (backgroundImage) {
      page.drawImage(backgroundImage, {
        x: 0,
        y: 0,
        width,
        height,
      })
    }

    // Header
    if (settings.business_name) {
      page.drawText(settings.business_name, {
        x: 50,
        y: height - 40,
        size: 18,
        font: boldFont,
        color: rgb(0.1, 0.1, 0.1),
      })
    }

    if (settings.catalogue_title) {
      page.drawText(settings.catalogue_title, {
        x: 50,
        y: height - 65,
        size: 14,
        font,
        color: rgb(0.3, 0.3, 0.3),
      })
    }

    const pageItems = items.slice(
      pageIndex * productsPerPage,
      (pageIndex + 1) * productsPerPage
    )

    pageItems.forEach((item, itemIndex) => {
      const baseY =
        height -
        100 -
        itemIndex * (layout.itemSpacingY ?? 180)
      drawCatalogueItem(page, item, settings, layout, baseY, font, boldFont)
    })

    if (settings.footer_text) {
      page.drawText(settings.footer_text, {
        x: 50,
        y: 30,
        size: 9,
        font,
        color: rgb(0.5, 0.5, 0.5),
      })
    }
  }

  return pdfDoc.save()
}

function drawCatalogueItem(
  page: ReturnType<PDFDocument['getPage']>,
  item: CatalogueItem,
  settings: UserSettings,
  layout: CatalogueLayoutConfig,
  baseY: number,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  boldFont: Awaited<ReturnType<PDFDocument['embedFont']>>
) {
  const currency = settings.currency || '£'

  drawField(
    page,
    item.productName,
    layout.productName,
    baseY,
    boldFont,
    layout.productName.fontSize ?? 14
  )

  const varietyText = [item.varietyName, item.sizeLabel]
    .filter(Boolean)
    .join(' — ')
  drawField(
    page,
    varietyText,
    layout.varietyName,
    baseY,
    font,
    layout.varietyName.fontSize ?? 12
  )

  if (settings.show_prices) {
    drawField(
      page,
      `${currency}${item.sellingPrice.toFixed(2)}`,
      layout.price,
      baseY,
      boldFont,
      layout.price.fontSize ?? 14
    )
  }

  if (settings.show_descriptions && item.description) {
    const desc =
      item.description.length > 80
        ? item.description.slice(0, 77) + '...'
        : item.description
    drawField(
      page,
      desc,
      layout.description,
      baseY,
      font,
      layout.description.fontSize ?? 10
    )
  }

  if (item.sku) {
    drawField(
      page,
      `SKU: ${item.sku}`,
      layout.sku,
      baseY,
      font,
      layout.sku.fontSize ?? 9
    )
  }

  // Future: embed product images at layout.image position when show_images is true
  void settings.show_images
  void item.imageUrl
  void layout.image
}

function drawField(
  page: ReturnType<PDFDocument['getPage']>,
  text: string,
  field: { x: number; y: number; align?: string },
  baseY: number,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  size: number
) {
  page.drawText(text, {
    x: field.x,
    y: baseY - field.y,
    size,
    font,
    color: rgb(0.1, 0.1, 0.1),
  })
}

async function fetchTemplateBytes(url: string): Promise<ArrayBuffer> {
  if (url.startsWith('data:')) {
    const base64 = url.split(',')[1]
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes.buffer
  }
  const response = await fetch(url)
  return response.arrayBuffer()
}

function getDefaultLayout(): CatalogueLayoutConfig {
  return {
    productName: { x: 50, y: 80, fontSize: 14, align: 'left' },
    varietyName: { x: 50, y: 100, fontSize: 12, align: 'left' },
    price: { x: 50, y: 120, fontSize: 14, align: 'left' },
    description: { x: 50, y: 140, fontSize: 10, align: 'left' },
    image: { x: 400, y: 50, width: 120, height: 120 },
    sku: { x: 50, y: 160, fontSize: 9, align: 'left' },
    productsPerPage: 4,
    fontSize: 12,
    textAlign: 'left',
    itemSpacingY: 180,
  }
}

export function searchResultsToCatalogueItems(
  results: DashboardSearchResult[]
): CatalogueItem[] {
  return results.map((r) => ({
    productName: r.product.name,
    varietyName: r.variety.variety_name,
    sizeLabel: r.variety.size_label,
    sellingPrice: r.variety.selling_price,
    description: r.product.description,
    imageUrl: r.product.image_url,
    sku: r.variety.sku,
  }))
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
