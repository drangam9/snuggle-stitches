import { WorkerEntrypoint } from 'cloudflare:workers'
import type { Env } from './env'
import { parseProductInput, serializeProduct, slugify, type ProductInput, type ProductRecord, type ProductRow } from './products'

const productSelect = `SELECT id, slug, name, tag, short, description, alt,
  category, price_min_ron, price_max_ron,
  image_key, image_url, credit_author, credit_url, credit_license, is_published,
  sort_order, created_at, updated_at FROM products`
const maxImageBytes = 5 * 1024 * 1024
const allowedImageTypes = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
])
const adminSessionCookie = 'snuggle_stitches_admin'
const adminSessionDurationSeconds = 24 * 60 * 60
const minimumAdminPasswordLength = 8

class HttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    try {
      if (url.pathname.startsWith('/api/')) {
        const limited = await checkRateLimit(request, env, url)
        if (limited) return limited
      }
      if (url.pathname === '/api/products' && request.method === 'GET') {
        // Normalize the request so cookies, query strings and client cache directives cannot bypass the shared cache.
        const response = await ctx.exports.PublicCatalog.fetch(new Request(new URL('/api/products', url)))
        const outgoing = new Response(response.body, response)
        outgoing.headers.set('cache-control', 'no-store')
        return outgoing
      }

      if (url.pathname.startsWith('/api/images/') && request.method === 'GET') {
        return await getImage(env, decodeURIComponent(url.pathname.slice('/api/images/'.length)))
      }

      if (url.pathname === '/api/admin/session') {
        if (request.method === 'POST' || request.method === 'DELETE') {
          if (!isSameOrigin(request, url, env)) {
            throw new HttpError(403, 'Admin authentication requests must come from this website.')
          }
          if (request.method === 'POST') return await createAdminSession(request, env)
          return clearAdminSession(env)
        }
        if (request.method === 'GET') {
          await requireAdmin(request, env)
          return json({ authenticated: true })
        }
        throw new HttpError(405, 'This method is not allowed for this endpoint.')
      }

      if (url.pathname === '/api/admin/products' || url.pathname.startsWith('/api/admin/products/')) {
        await requireAdmin(request, env)
        if (request.method !== 'GET' && !isSameOrigin(request, url, env)) {
          throw new HttpError(403, 'Product changes must come from this website.')
        }
        const response = await handleAdminProducts(request, env, url)
        if (response.ok && request.method !== 'GET') {
          try {
            await ctx.exports.PublicCatalog.purge()
          } catch (error) {
            console.error('Public catalogue cache purge failed after product change.', error)
            const payload = await response.json() as { warning?: string }
            return json({
              ...payload,
              warning: [payload.warning, 'Modificarea a fost salvată, dar colecția publică poate afișa datele vechi până la 5 minute.'].filter(Boolean).join(' '),
            }, response.status)
          }
        }
        return response
      }

      if (url.pathname.startsWith('/api/')) {
        throw new HttpError(404, 'This API endpoint was not found.')
      }

      return env.ASSETS.fetch(request)
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status)
      console.error('Product API request failed', error)
      return json({ error: 'The request could not be completed. Please try again.' }, 500)
    }
  },
}

async function checkRateLimit(request: Request, env: Env, url: URL): Promise<Response | null> {
  const ip = request.headers.get('cf-connecting-ip')
  if (!ip && env.ENVIRONMENT !== 'local') throw new HttpError(400, 'Client address is missing.')
  const key = ip ?? 'local'
  const limiter = url.pathname === '/api/admin/session' && request.method === 'POST'
    ? env.LOGIN_LIMITER
    : url.pathname === '/api/admin' || url.pathname.startsWith('/api/admin/')
      ? env.ADMIN_LIMITER
      : env.PUBLIC_LIMITER
  const { success } = await limiter.limit({ key })
  if (success) return null
  const response = json({ error: 'Prea multe cereri. Așteaptă un minut și încearcă din nou.' }, 429)
  response.headers.set('retry-after', '60')
  return response
}

export class PublicCatalog extends WorkerEntrypoint<Env> {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET' || new URL(request.url).pathname !== '/api/products') {
      return json({ error: 'This API endpoint was not found.' }, 404)
    }
    try {
      return Response.json({ products: await getProducts(this.env, true) }, {
        headers: {
          'cache-control': 'public, max-age=300',
          'cache-tag': 'public-catalogue',
          'x-content-type-options': 'nosniff',
        },
      })
    } catch (error) {
      console.error('Public catalogue database read failed.', error)
      return json({ error: 'The request could not be completed. Please try again.' }, 500)
    }
  }

  async purge(): Promise<void> {
    if (!this.ctx.cache) throw new Error('Workers Caching is not available.')
    const result = await this.ctx.cache.purge({ tags: ['public-catalogue'] })
    if (!result.success) throw new Error('Public catalogue cache purge was not successful.')
  }
}

async function getProducts(env: Env, publishedOnly: boolean): Promise<ProductRow[]> {
  const query = publishedOnly
    ? `${productSelect} WHERE is_published = 1 ORDER BY sort_order ASC, created_at DESC`
    : `${productSelect} ORDER BY sort_order ASC, created_at DESC`
  const result = await env.DB.prepare(query).all<ProductRecord>()
  return result.results.map(serializeProduct)
}

async function getImage(env: Env, key: string): Promise<Response> {
  if (!key.startsWith('products/') || key.includes('..') || key.includes('\\')) {
    throw new HttpError(404, 'Image not found.')
  }
  const object = await env.IMAGES.get(key)
  if (!object) throw new HttpError(404, 'Image not found.')
  const headers = new Headers({
    'cache-control': 'public, max-age=86400, immutable',
    'content-type': object.httpMetadata?.contentType ?? 'application/octet-stream',
    etag: object.httpEtag,
    'x-content-type-options': 'nosniff',
  })
  return new Response(object.body, { headers })
}

async function handleAdminProducts(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname.replace(/\/+$/, '')
  if (path === '/api/admin/products' && request.method === 'GET') {
    return json({ products: await getProducts(env, false) })
  }
  if (path === '/api/admin/products' && request.method === 'POST') {
    const { input, image } = await readProductRequest(request)
    return await createProduct(env, input, image)
  }
  if (path === '/api/admin/products/reorder' && request.method === 'PUT') {
    return await reorderProducts(request, env)
  }

  const id = path.slice('/api/admin/products/'.length)
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, 'Product not found.')
  if (request.method === 'PUT') {
    const { input, image } = await readProductRequest(request)
    return await updateProduct(env, id, input, image)
  }
  if (request.method === 'DELETE') return await deleteProduct(env, id)
  throw new HttpError(405, 'This method is not allowed for this endpoint.')
}

async function reorderProducts(request: Request, env: Env): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw new HttpError(400, 'Send a valid product order.')
  }
  const productIds = body && typeof body === 'object' && 'productIds' in body ? body.productIds : undefined
  if (!Array.isArray(productIds) || !productIds.every((id): id is string => typeof id === 'string')) {
    throw new HttpError(400, 'Send a valid product order.')
  }

  const currentProducts = await getProducts(env, false)
  const currentIds = new Set(currentProducts.map((product) => product.id))
  if (
    productIds.length !== currentProducts.length ||
    new Set(productIds).size !== productIds.length ||
    !productIds.every((id) => currentIds.has(id))
  ) {
    throw new HttpError(400, 'The order must include every product exactly once.')
  }

  if (productIds.length > 0) {
    await env.DB.batch(productIds.map((id, index) =>
      env.DB.prepare('UPDATE products SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .bind(index + 1, id),
    ))
  }
  return json({ products: await getProducts(env, false) })
}

async function readProductRequest(request: Request): Promise<{ input: ProductInput; image: File | null }> {
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > maxImageBytes + 128 * 1024) {
    throw new HttpError(413, 'Choose an image smaller than 5 MB.')
  }
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    throw new HttpError(400, 'Send product details as a multipart form.')
  }

  let data: unknown
  try {
    data = JSON.parse(String(form.get('product') ?? ''))
  } catch {
    throw new HttpError(400, 'Product details are missing or invalid.')
  }

  let image: File | null = null
  const file = form.get('image')
  if (file instanceof File && file.size > 0) {
    if (file.size > maxImageBytes) throw new HttpError(413, 'Choose an image smaller than 5 MB.')
    if (!allowedImageTypes.has(file.type)) throw new HttpError(415, 'Use a JPG, PNG, or WebP image.')
    if (!(await isValidImageContent(file))) throw new HttpError(415, 'The selected file is not a valid JPG, PNG, or WebP image.')
    image = file
  }

  try {
    return { input: parseProductInput(data, image !== null), image }
  } catch (error) {
    if (error instanceof Error) throw new HttpError(400, error.message)
    throw error
  }
}

async function isValidImageContent(file: File): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  if (file.type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (file.type === 'image/png') return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte)
  return file.type === 'image/webp' &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
}

async function createProduct(env: Env, input: ProductInput, image: File | null): Promise<Response> {
  const id = crypto.randomUUID()
  const imageKey = image ? makeImageKey(id, image) : null
  if (image && imageKey) await env.IMAGES.put(imageKey, image.stream(), { httpMetadata: { contentType: image.type } })
  try {
    await env.DB.prepare(`INSERT INTO products (
      id, slug, name, tag, short, description, alt, category, price_min_ron, price_max_ron, image_key,
      image_url, credit_author, credit_url, credit_license, is_published, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` )
      .bind(...inputBindings(id, input.name, input, imageKey))
      .run()
  } catch (error) {
    if (imageKey) await env.IMAGES.delete(imageKey)
    if (isUniqueViolation(error)) throw new HttpError(409, 'A product with that URL-friendly name already exists.')
    throw error
  }
  const product = await getProduct(env, id)
  return json({ product }, 201)
}

async function updateProduct(env: Env, id: string, input: ProductInput, image: File | null): Promise<Response> {
  const current = await findProduct(env, id)
  if (!current) throw new HttpError(404, 'Product not found.')
  const imageKey = image ? makeImageKey(id, image) : current.image_key
  if (image && imageKey) await env.IMAGES.put(imageKey, image.stream(), { httpMetadata: { contentType: image.type } })
  try {
    await env.DB.prepare(`UPDATE products SET slug = ?, name = ?, tag = ?, short = ?,
      description = ?, alt = ?,
      category = ?, price_min_ron = ?, price_max_ron = ?, image_key = ?, image_url = ?,
      credit_author = ?, credit_url = ?, credit_license = ?, is_published = ?, sort_order = ?,
      updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(
        slugify(input.name),
        input.name, input.tag, input.short, input.description, input.alt, input.category,
        input.priceMinRon, input.priceMaxRon, imageKey, image ? null : input.imageUrl,
        input.creditAuthor, input.creditUrl, input.creditLicense, Number(input.published),
        input.sortOrder, id,
      ).run()
  } catch (error) {
    if (image && imageKey) await env.IMAGES.delete(imageKey)
    if (isUniqueViolation(error)) throw new HttpError(409, 'A product with that URL-friendly name already exists.')
    throw error
  }

  let warning: string | undefined
  if (image && current.image_key) {
    try {
      await env.IMAGES.delete(current.image_key)
    } catch (error) {
      console.error('Old product image could not be deleted', { productId: id, error })
      warning = 'The product was updated, but its previous image could not be removed from storage.'
    }
  }
  return json({ product: await getProduct(env, id), warning })
}

async function deleteProduct(env: Env, id: string): Promise<Response> {
  const current = await findProduct(env, id)
  if (!current) throw new HttpError(404, 'Product not found.')
  await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run()
  let warning: string | undefined
  if (current.image_key) {
    try {
      await env.IMAGES.delete(current.image_key)
    } catch (error) {
      console.error('Deleted product image could not be removed from storage', { productId: id, error })
      warning = 'The product was deleted, but its image could not be removed from storage.'
    }
  }
  return json({ deleted: true, warning })
}

async function findProduct(env: Env, id: string): Promise<ProductRecord | null> {
  return env.DB.prepare(`${productSelect} WHERE id = ?`).bind(id).first<ProductRecord>()
}

async function getProduct(env: Env, id: string): Promise<ProductRow> {
  const row = await findProduct(env, id)
  if (!row) throw new Error('Saved product could not be read back from the database.')
  return serializeProduct(row)
}

function inputBindings(id: string, slugSource: string, input: ProductInput, imageKey: string | null) {
  return [
    id, slugify(slugSource), input.name, input.tag, input.short, input.description,
    input.alt, input.category, input.priceMinRon, input.priceMaxRon, imageKey,
    imageKey ? null : input.imageUrl, input.creditAuthor, input.creditUrl,
    input.creditLicense, Number(input.published), input.sortOrder,
  ]
}

function makeImageKey(id: string, image: File): string {
  const extension = allowedImageTypes.get(image.type)
  if (!extension) throw new HttpError(415, 'Use a JPG, PNG, or WebP image.')
  return `products/${id}/${crypto.randomUUID()}.${extension}`
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes('unique')
}

async function createAdminSession(request: Request, env: Env): Promise<Response> {
  const password = configuredAdminPassword(env)
  if (Number(request.headers.get('content-length') ?? 0) > 2048) {
    throw new HttpError(413, 'The password request is too large.')
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    throw new HttpError(400, 'Send the admin password as JSON.')
  }
  if (
    typeof payload !== 'object' || payload === null || !('password' in payload) ||
    typeof payload.password !== 'string' || payload.password.length > 512
  ) {
    throw new HttpError(400, 'Enter a valid admin password.')
  }
  if (!constantTimeEqual(payload.password, password)) {
    throw new HttpError(401, 'Parola introdusă este incorectă.')
  }

  const expiresAt = Math.floor(Date.now() / 1000) + adminSessionDurationSeconds
  const key = await importSessionKey(password)
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`snuggle-stitches-admin:v1:${expiresAt}`),
  )
  const cookieValue = `${expiresAt}.${encodeBase64Url(new Uint8Array(signature))}`
  const secure = env.ENVIRONMENT === 'local' ? '' : '; Secure'
  const response = json({ authenticated: true })
  response.headers.set(
    'set-cookie',
    `${adminSessionCookie}=${cookieValue}; HttpOnly${secure}; SameSite=Strict; Path=/api/admin; Max-Age=${adminSessionDurationSeconds}`,
  )
  return response
}

function clearAdminSession(env: Env): Response {
  const secure = env.ENVIRONMENT === 'local' ? '' : '; Secure'
  const response = json({ authenticated: false })
  response.headers.set(
    'set-cookie',
    `${adminSessionCookie}=; HttpOnly${secure}; SameSite=Strict; Path=/api/admin; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
  )
  return response
}

async function requireAdmin(request: Request, env: Env): Promise<void> {
  const password = configuredAdminPassword(env)
  const cookie = request.headers.get('cookie')?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${adminSessionCookie}=`))
  const value = cookie?.slice(adminSessionCookie.length + 1) ?? ''
  const [expiryText, signatureText, extra] = value.split('.')
  if (!expiryText || !signatureText || extra !== undefined || !/^\d{10}$/.test(expiryText)) {
    throw new HttpError(401, 'Autentifică-te cu parola de administrator.')
  }

  const expiresAt = Number(expiryText)
  const now = Math.floor(Date.now() / 1000)
  if (expiresAt <= now || expiresAt > now + adminSessionDurationSeconds) {
    throw new HttpError(401, 'Sesiunea a expirat. Autentifică-te din nou.')
  }

  let signature: ArrayBuffer
  try {
    signature = decodeBase64Url(signatureText)
  } catch {
    throw new HttpError(401, 'Sesiunea de administrator nu este validă.')
  }
  const key = await importSessionKey(password)
  const isValid = await crypto.subtle.verify(
    'HMAC',
    key,
    signature,
    new TextEncoder().encode(`snuggle-stitches-admin:v1:${expiresAt}`),
  )
  if (!isValid) throw new HttpError(401, 'Sesiunea de administrator nu este validă.')
}

function configuredAdminPassword(env: Env): string {
  if (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < minimumAdminPasswordLength) {
    throw new HttpError(503, `Configure ADMIN_PASSWORD as a secret with at least ${minimumAdminPasswordLength} characters.`)
  }
  return env.ADMIN_PASSWORD
}

async function importSessionKey(password: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeBase64Url(value: string): ArrayBuffer {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid base64url value.')
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes.buffer
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left)
  const rightBytes = new TextEncoder().encode(right)
  let difference = leftBytes.length ^ rightBytes.length
  const maxLength = Math.max(leftBytes.length, rightBytes.length)
  for (let index = 0; index < maxLength; index++) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0)
  }
  return difference === 0
}

function isSameOrigin(request: Request, url: URL, env: Env): boolean {
  const origin = request.headers.get('origin')
  if (origin === url.origin) return true
  if (env.ENVIRONMENT !== 'local' || !origin) return false
  try {
    const originHost = new URL(origin).hostname
    const isLoopback = (hostname: string) => hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
    return isLoopback(originHost) && isLoopback(url.hostname)
  } catch {
    return false
  }
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  })
}
