export type ProductCategory = string

export function productImages(product: { images?: string[]; imageUrl: string }): string[] {
  return product.images ?? (product.imageUrl ? [product.imageUrl] : [])
}

export interface ProductInput {
  name: string
  tag: string
  short: string
  description: string
  alt: string
  category: ProductCategory
  priceMinRon: number
  priceMaxRon: number
  imageUrl: string
  creditAuthor: string
  creditUrl: string
  creditLicense: string
  published: boolean
  sortOrder: number
}

export interface ProductRow extends ProductInput {
  images: string[]
  id: string
  slug: string
  imageKey: string | null
  createdAt: string
  updatedAt: string
}

export interface ProductRecord {
  images_json?: string | null
  id: string
  slug: string
  name: string
  tag: string
  short: string
  description: string
  alt: string
  category: ProductCategory
  price_min_ron: number
  price_max_ron: number
  image_key: string | null
  image_url: string | null
  credit_author: string
  credit_url: string
  credit_license: string
  is_published: number
  sort_order: number
  created_at: string
  updated_at: string
}

const textFields = [
  ['name', 'Add a product name.', 120, true],
  ['tag', 'Add a product label.', 80, true],
  ['short', 'Add a short description.', 180, true],
  ['description', 'Add a product description.', 2000, true],
  ['alt', 'Add alternative text for the image.', 250, true],
  ['creditAuthor', 'Image attribution is too long.', 160, false],
  ['creditUrl', 'Image credit URL is too long.', 500, false],
  ['creditLicense', 'Image license is too long.', 120, false],
] as const

export function parseProductInput(value: unknown, hasImageUpload = false): ProductInput {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Product data must be an object.')
  }

  const source = value as Record<string, unknown>
  const text: Record<string, string> = {}

  for (const [field, message, maxLength, required] of textFields) {
    const item = source[field]
    if (typeof item !== 'string' || item.length > maxLength || (required && !item.trim())) {
      throw new Error(message)
    }
    text[field] = item.trim()
  }

  if (typeof source.category !== 'string' || !source.category.trim() || source.category.trim().length > 60) {
    throw new Error('Enter a category name between 1 and 60 characters.')
  }
  const category = source.category.trim()
  if (text.creditUrl) {
    try {
      if (new URL(text.creditUrl).protocol !== 'https:') throw new Error()
    } catch {
      throw new Error('Use a valid HTTPS image credit URL.')
    }
  }

  const priceMinRon = source.priceMinRon
  const priceMaxRon = source.priceMaxRon
  if (typeof priceMinRon !== 'number' || !Number.isSafeInteger(priceMinRon) || priceMinRon < 0 || priceMinRon > 1_000_000) {
    throw new Error('Enter a valid minimum price in RON.')
  }
  if (typeof priceMaxRon !== 'number' || !Number.isSafeInteger(priceMaxRon) || priceMaxRon < 0 || priceMaxRon > 1_000_000) {
    throw new Error('Enter a valid maximum price in RON.')
  }
  if (priceMaxRon < priceMinRon) throw new Error('Maximum price must be at least the minimum price.')

  if (typeof source.imageUrl !== 'string' || source.imageUrl.length > 1000) {
    throw new Error('Use an HTTPS image URL or a local /images/ path.')
  }
  const imageUrl = source.imageUrl.trim()
  if (imageUrl && !isAllowedImageUrl(imageUrl)) {
    throw new Error('Use an HTTPS image URL or a local /images/ path.')
  }
  if (typeof source.published !== 'boolean') {
    throw new Error('Choose whether this product is published.')
  }
  if (typeof source.sortOrder !== 'number' || !Number.isSafeInteger(source.sortOrder) || source.sortOrder < 0 || source.sortOrder > 1_000_000) {
    throw new Error('Choose a valid display order.')
  }
  if (source.published && !imageUrl && !hasImageUpload) {
    throw new Error('Add a product image before publishing.')
  }

  return {
    name: text.name,
    tag: text.tag,
    short: text.short,
    description: text.description,
    alt: text.alt,
    creditAuthor: text.creditAuthor,
    creditUrl: text.creditUrl,
    creditLicense: text.creditLicense,
    category,
    priceMinRon,
    priceMaxRon,
    imageUrl,
    published: source.published,
    sortOrder: source.sortOrder,
  }
}

export function isAllowedImageUrl(value: string): boolean {
  if (value.startsWith('/images/')) return !value.includes('..') && !value.includes('\\')
  if (value.startsWith('/api/images/')) {
    try {
      const key = decodeURIComponent(value.slice('/api/images/'.length))
      return key.startsWith('products/') && !key.includes('..') && !key.includes('\\')
    } catch {
      return false
    }
  }
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

export function serializeProduct(row: ProductRecord): ProductRow {
  const cover = row.image_key ? `/api/images/${encodeURIComponent(row.image_key)}` : row.image_url ?? ''
  const images: unknown = row.images_json == null ? (cover ? [cover] : []) : JSON.parse(row.images_json)
  if (!Array.isArray(images) || images.length > 5 || !images.every((url): url is string => typeof url === 'string' && isAllowedImageUrl(url))) {
    throw new Error('Stored product gallery is invalid.')
  }
  return {
    images,
    id: row.id,
    slug: row.slug,
    name: row.name,
    tag: row.tag,
    short: row.short,
    description: row.description,
    alt: row.alt,
    category: row.category,
    priceMinRon: row.price_min_ron,
    priceMaxRon: row.price_max_ron,
    imageKey: row.image_key,
    imageUrl: images[0] ?? '',
    creditAuthor: row.credit_author,
    creditUrl: row.credit_url,
    creditLicense: row.credit_license,
    published: row.is_published === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function slugify(value: string): string {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || 'handmade-friend'
}
