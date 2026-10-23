import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from './env'
import handler, { PublicCatalog } from './index'
import type { ProductInput, ProductRecord } from './products'

let ctx: ExecutionContext
let cachedFetch: ReturnType<typeof vi.fn>
let purge: ReturnType<typeof vi.fn>

const worker = {
  fetch(request: Request, bindings: Env) {
    const withIp = new Request(request)
    if (!withIp.headers.has('cf-connecting-ip')) withIp.headers.set('cf-connecting-ip', '192.0.2.1')
    return handler.fetch(withIp, bindings, ctx)
  },
}

function rateLimiter(limit: number): RateLimit {
  const counts = new Map<string, number>()
  return {
    limit: vi.fn(async ({ key }: { key: string }) => {
      const count = (counts.get(key) ?? 0) + 1
      counts.set(key, count)
      return { success: count <= limit }
    }),
  }
}

const productInput: ProductInput = {
  name: 'Iepuraș',
  tag: 'Un dar drag',
  short: 'Urechi pufoase',
  description: 'Un companion lucrat manual.',
  alt: 'Iepuraș croșetat',
  category: 'Animăluțe',
  priceMinRon: 75,
  priceMaxRon: 200,
  imageUrl: '',
  creditAuthor: '',
  creditUrl: '',
  creditLicense: '',
  published: false,
  sortOrder: 1,
}

let records: ProductRecord[]
let env: Env
let adminCookie: string | null

beforeEach(() => {
  records = []
  adminCookie = null
  const db = {
    prepare(query: string) {
      let values: unknown[] = []
      return {
        bind(...bindings: unknown[]) {
          values = bindings
          return this
        },
        async all() {
          return { results: query.includes('WHERE is_published = 1') ? records.filter((record) => record.is_published === 1) : records }
        },
        async first<T>() {
          const id = String(values[0] ?? '')
          const record = records.find((record) => record.id === id)
          return (record ? { ...record } : null) as T | null
        },
        async run() {
          if (query.startsWith('INSERT INTO products')) {
            const [
              id, slug, name, tag, short, description, alt, category,
              price_min_ron, price_max_ron, image_key, image_url, credit_author,
              credit_url, credit_license, is_published, sort_order, images_json,
            ] = values
            records.push({
              id: String(id), slug: String(slug), name: String(name), tag: String(tag), short: String(short),
              description: String(description), alt: String(alt), category: category as ProductRecord['category'],
              price_min_ron: Number(price_min_ron), price_max_ron: Number(price_max_ron),
              image_key: image_key as string | null, image_url: image_url as string | null,
              credit_author: String(credit_author), credit_url: String(credit_url), credit_license: String(credit_license),
              is_published: Number(is_published), sort_order: Number(sort_order),
              images_json: typeof images_json === 'string' ? images_json : null,
              created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
            })
          }
          if (query.startsWith('UPDATE products SET')) {
            if (query.startsWith('UPDATE products SET sort_order = ?')) {
              const record = records.find((item) => item.id === String(values[1]))
              if (record) record.sort_order = Number(values[0])
              return { success: true }
            }
            const record = records.find((item) => item.id === String(values.at(-1)))
            if (!record) return { success: true }
            const [
              slug, name, tag, short, description, alt, category,
              price_min_ron, price_max_ron, image_key, image_url, credit_author,
              credit_url, credit_license, is_published, sort_order, images_json,
            ] = values
            Object.assign(record, {
              slug, name, tag, short, description, alt, category,
              price_min_ron, price_max_ron, image_key, image_url, credit_author,
              credit_url, credit_license, is_published, sort_order, images_json,
            })
          }
          if (query.startsWith('DELETE FROM products')) {
            records = records.filter((record) => record.id !== String(values[0]))
          }
          return { success: true }
        },
      }
    },
    async batch(statements: { run: () => Promise<unknown> }[]) {
      for (const statement of statements) await statement.run()
      return []
    },
  }
  env = {
    DB: db as unknown as D1Database,
    IMAGES: { get: vi.fn(), put: vi.fn(), delete: vi.fn() } as unknown as R2Bucket,
    ASSETS: { fetch: vi.fn() } as unknown as Fetcher,
    ENVIRONMENT: 'production',
    ADMIN_PASSWORD: 'test-admin-password-with-more-than-thirty-two-characters',
    LOGIN_LIMITER: rateLimiter(5),
    ADMIN_LIMITER: rateLimiter(60),
    PUBLIC_LIMITER: rateLimiter(240),
  }
  purge = vi.fn(async () => {})
  cachedFetch = vi.fn((request: Request) => new PublicCatalog(ctx, env).fetch(request))
  ctx = {
    exports: { PublicCatalog: { fetch: cachedFetch, purge } },
    cache: { purge: vi.fn(async () => ({ success: true, errors: [] })), invalidate: vi.fn() },
  } as unknown as ExecutionContext
})

function adminRequest(path: string, method = 'GET', body?: BodyInit, headers: Record<string, string> = {}) {
  return new Request(`https://shop.test${path}`, {
    method,
    headers: {
      origin: 'https://shop.test',
      ...(adminCookie ? { cookie: adminCookie } : {}),
      ...headers,
    },
    body,
  })
}

async function login(password = env.ADMIN_PASSWORD) {
  const response = await worker.fetch(new Request('https://shop.test/api/admin/session', {
    method: 'POST',
    headers: { origin: 'https://shop.test', 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  }), env)
  const setCookie = response.headers.get('set-cookie')
  if (response.ok && setCookie) adminCookie = setCookie.split(';', 1)[0]
  return response
}

describe('product Worker API', () => {
  it('rejects the sixth login attempt before password validation, with a retry delay', async () => {
    for (let index = 0; index < 5; index++) expect((await login('wrong')).status).toBe(401)
    const response = await login()
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('60')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.has('set-cookie')).toBe(false)
    expect(env.ADMIN_LIMITER.limit).not.toHaveBeenCalled()
    expect((await worker.fetch(new Request('https://shop.test/api/admin/session', {
      method: 'POST',
      headers: { origin: 'https://shop.test', 'cf-connecting-ip': '192.0.2.2' },
      body: JSON.stringify({ password: env.ADMIN_PASSWORD }),
    }), env)).status).toBe(200)
  })

  it.each([
    ['/api/admin/products', 60, 401],
    ['/api/not-found', 240, 404],
  ])('limits %s at the configured API budget', async (path, limit, initialStatus) => {
    for (let index = 0; index < limit; index++) {
      expect((await worker.fetch(new Request(`https://shop.test${path}`), env)).status).toBe(initialStatus)
    }
    expect((await worker.fetch(new Request(`https://shop.test${path}`), env)).status).toBe(429)
  })

  it('limits image API requests but not static assets', async () => {
    vi.mocked(env.PUBLIC_LIMITER.limit).mockResolvedValue({ success: false })
    expect((await worker.fetch(new Request('https://shop.test/api/images/products/photo.jpg'), env)).status).toBe(429)
    expect(env.IMAGES.get).not.toHaveBeenCalled()
    vi.mocked(env.ASSETS.fetch).mockResolvedValue(new Response('asset'))
    expect((await worker.fetch(new Request('https://shop.test/admin.html'), env)).status).toBe(200)
    expect(env.PUBLIC_LIMITER.limit).toHaveBeenCalledTimes(1)
  })

  it('requires Cloudflare client IP outside local development, ignoring spoofable forwarding headers', async () => {
    const request = new Request('https://shop.test/api/products', { headers: { 'x-forwarded-for': '192.0.2.10' } })
    expect((await handler.fetch(request, env, ctx)).status).toBe(400)
    expect(env.PUBLIC_LIMITER.limit).not.toHaveBeenCalled()
    env.ENVIRONMENT = 'local'
    expect((await handler.fetch(request, env, ctx)).status).toBe(200)
    expect(env.PUBLIC_LIMITER.limit).toHaveBeenCalledWith({ key: 'local' })
  })

  it('normalizes cached catalogue requests and keeps client responses uncached', async () => {
    const response = await worker.fetch(new Request('https://shop.test/api/products?bust=123', {
      headers: { authorization: 'Bearer unused', cookie: 'test=1', 'cache-control': 'no-cache' },
    }), env)
    expect(response.status).toBe(200)
    const forwarded = cachedFetch.mock.calls[0][0] as Request
    expect(new URL(forwarded.url).search).toBe('')
    expect([...forwarded.headers]).toEqual([])
    expect(response.headers.get('cache-control')).toBe('no-store')
    const innerResponse = await new PublicCatalog(ctx, env).fetch(forwarded)
    expect(innerResponse.headers.get('cache-control')).toBe('public, max-age=300')
    expect(innerResponse.headers.get('cache-tag')).toBe('public-catalogue')
    expect(env.PUBLIC_LIMITER.limit).toHaveBeenCalledOnce()
  })

  it('reports cache purge failures without misrepresenting a committed product change', async () => {
    await login()
    purge.mockRejectedValue(new Error('Cache unavailable'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const body = new FormData()
      body.set('product', JSON.stringify(productInput))
      const response = await worker.fetch(adminRequest('/api/admin/products', 'POST', body), env)
      expect(response.status).toBe(201)
      expect(await response.json()).toEqual(expect.objectContaining({ warning: expect.stringContaining('5 minute') }))
      expect(records).toHaveLength(1)
      expect(log).toHaveBeenCalled()
    } finally {
      log.mockRestore()
    }
  })

  it('purges only the cached entrypoint and surfaces unsuccessful purge results', async () => {
    await new PublicCatalog(ctx, env).purge()
    expect(ctx.cache?.purge).toHaveBeenCalledWith({ tags: ['public-catalogue'] })
    vi.mocked(ctx.cache!.purge).mockResolvedValue({ success: false, errors: [] })
    await expect(new PublicCatalog(ctx, env).purge()).rejects.toThrow('not successful')
  })

  it('does not cache catalogue errors and retries the database on a later request', async () => {
    const prepare = vi.spyOn(env.DB, 'prepare').mockImplementationOnce(() => { throw new Error('D1 unavailable') })
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const response = await worker.fetch(new Request('https://shop.test/api/products'), env)
      expect(response.status).toBe(500)
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(log).toHaveBeenCalled()
      expect((await worker.fetch(new Request('https://shop.test/api/products'), env)).status).toBe(200)
      expect(prepare).toHaveBeenCalledTimes(2)
    } finally {
      prepare.mockRestore()
      log.mockRestore()
    }
  })

  it('fails closed with an explicit server error if a rate limiter is unavailable', async () => {
    vi.mocked(env.PUBLIC_LIMITER.limit).mockRejectedValue(new Error('Rate limiter unavailable'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect((await worker.fetch(new Request('https://shop.test/api/products'), env)).status).toBe(500)
      expect(cachedFetch).not.toHaveBeenCalled()
      expect(log).toHaveBeenCalled()
    } finally {
      log.mockRestore()
    }
  })

  it('returns only published products publicly and rejects unauthenticated admin access', async () => {
    const publicResponse = await worker.fetch(new Request('https://shop.test/api/products'), env)
    expect(publicResponse.status).toBe(200)
    expect(await publicResponse.json()).toEqual({ products: [] })

    const adminResponse = await worker.fetch(new Request('https://shop.test/api/admin/products'), env)
    expect(adminResponse.status).toBe(401)
  })

  it('authenticates with the shared password and issues a secure session cookie', async () => {
    const invalidResponse = await login('incorrect-password')
    expect(invalidResponse.status).toBe(401)

    const loginResponse = await login()
    expect(loginResponse.status).toBe(200)
    expect(loginResponse.headers.get('set-cookie')).toMatch(
      /^snuggle_stitches_admin=[^;]+; HttpOnly; Secure; SameSite=Strict; Path=\/api\/admin; Max-Age=86400$/,
    )

    const productsResponse = await worker.fetch(adminRequest('/api/admin/products'), env)
    expect(productsResponse.status).toBe(200)
  })

  it('rejects cross-origin login and tampered admin sessions', async () => {
    const crossOriginResponse = await worker.fetch(new Request('https://shop.test/api/admin/session', {
      method: 'POST',
      headers: { origin: 'https://attacker.test', 'content-type': 'application/json' },
      body: JSON.stringify({ password: env.ADMIN_PASSWORD }),
    }), env)
    expect(crossOriginResponse.status).toBe(403)

    await login()
    adminCookie = `${adminCookie}tampered`
    const tamperedResponse = await worker.fetch(adminRequest('/api/admin/products'), env)
    expect(tamperedResponse.status).toBe(401)
  })

  it('creates drafts, exposes them only to the owner, and supports updating prices and deleting', async () => {
    await login()
    const body = new FormData()
    body.set('product', JSON.stringify(productInput))
    const createdResponse = await worker.fetch(adminRequest('/api/admin/products', 'POST', body), env)
    expect(createdResponse.status).toBe(201)
    const { product: created } = await createdResponse.json() as { product: { id: string; slug: string; published: boolean } }
    expect(created.slug).toBe('iepuras')
    expect(created.published).toBe(false)
    expect(purge).toHaveBeenCalledTimes(1)

    const publicResponse = await worker.fetch(new Request('https://shop.test/api/products'), env)
    expect((await publicResponse.json() as { products: unknown[] }).products).toHaveLength(0)
    const adminResponse = await worker.fetch(adminRequest('/api/admin/products'), env)
    expect((await adminResponse.json() as { products: unknown[] }).products).toHaveLength(1)
    expect(adminResponse.headers.get('cache-control')).toBe('no-store')
    expect(cachedFetch).toHaveBeenCalledTimes(1)

    const updateBody = new FormData()
    updateBody.set('product', JSON.stringify({
      ...productInput, priceMinRon: 90, priceMaxRon: 210, published: true, imageUrl: '/images/test-product.jpg',
    }))
    const updatedResponse = await worker.fetch(adminRequest(`/api/admin/products/${created.id}`, 'PUT', updateBody), env)
    expect(updatedResponse.status).toBe(200)
    expect((await updatedResponse.json() as { product: { priceMinRon: number; priceMaxRon: number } }).product)
      .toMatchObject({ priceMinRon: 90, priceMaxRon: 210 })
    expect(purge).toHaveBeenCalledTimes(2)
    const publishedResponse = await worker.fetch(new Request('https://shop.test/api/products'), env)
    expect((await publishedResponse.json() as { products: unknown[] }).products).toHaveLength(1)

    const deletedResponse = await worker.fetch(adminRequest(`/api/admin/products/${created.id}`, 'DELETE'), env)
    expect(deletedResponse.status).toBe(200)
    expect((await deletedResponse.json() as { deleted: boolean }).deleted).toBe(true)
    expect(purge).toHaveBeenCalledTimes(3)
  })

  it('saves a complete product order and rejects incomplete orders', async () => {
    await login()
    const createProduct = async (name: string) => {
      const body = new FormData()
      body.set('product', JSON.stringify({ ...productInput, name }))
      const response = await worker.fetch(adminRequest('/api/admin/products', 'POST', body), env)
      return (await response.json() as { product: { id: string } }).product
    }
    const first = await createProduct('Iepurașul întâi')
    const second = await createProduct('Iepurașul al doilea')

    const reorderedResponse = await worker.fetch(
      adminRequest(
        '/api/admin/products/reorder',
        'PUT',
        JSON.stringify({ productIds: [second.id, first.id] }),
        { 'content-type': 'application/json' },
      ),
      env,
    )
    expect(reorderedResponse.status).toBe(200)
    expect(purge).toHaveBeenCalledTimes(3)
    expect((await reorderedResponse.json() as { products: { id: string; sortOrder: number }[] }).products)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ id: second.id, sortOrder: 1 }),
        expect.objectContaining({ id: first.id, sortOrder: 2 }),
      ]))

    const invalidResponse = await worker.fetch(
      adminRequest(
        '/api/admin/products/reorder',
        'PUT',
        JSON.stringify({ productIds: [first.id, first.id] }),
        { 'content-type': 'application/json' },
      ),
      env,
    )
    expect(invalidResponse.status).toBe(400)
    expect(purge).toHaveBeenCalledTimes(3)
  })

  it('rejects cross-origin changes and invalid product payloads', async () => {
    await login()
    const body = new FormData()
    body.set('product', JSON.stringify(productInput))
    const crossOriginResponse = await worker.fetch(
      adminRequest('/api/admin/products', 'POST', body, { origin: 'https://attacker.test' }),
      env,
    )
    expect(crossOriginResponse.status).toBe(403)

    const invalidBody = new FormData()
    invalidBody.set('product', JSON.stringify({ ...productInput, priceMaxRon: 1 }))
    const invalidResponse = await worker.fetch(adminRequest('/api/admin/products', 'POST', invalidBody), env)
    expect(invalidResponse.status).toBe(400)
    expect(purge).not.toHaveBeenCalled()
  })

  it('persists ordered galleries and fixed prices, updates the cover, and removes only discarded stored images', async () => {
    await login()
    const body = new FormData()
    body.set('product', JSON.stringify({ ...productInput, priceMinRon: 120, priceMaxRon: 120, published: true }))
    body.set('gallery', JSON.stringify(['/images/first.jpg', '/images/second.jpg']))
    const createdResponse = await worker.fetch(adminRequest('/api/admin/products', 'POST', body), env)
    expect(createdResponse.status).toBe(201)
    const { product } = await createdResponse.json() as { product: { id: string; images: string[]; priceMaxRon: number } }
    expect(product.images).toEqual(['/images/first.jpg', '/images/second.jpg'])
    expect(product.priceMaxRon).toBe(120)
    const retained = `/api/images/${encodeURIComponent(`products/${product.id}/retained.png`)}`
    const removed = `products/${product.id}/removed.png`
    records[0].images_json = JSON.stringify([retained, `/api/images/${encodeURIComponent(removed)}`])
    const update = new FormData()
    update.set('product', JSON.stringify({ ...productInput, published: true }))
    update.set('gallery', JSON.stringify(['/images/new-cover.jpg', retained]))
    const updatedResponse = await worker.fetch(adminRequest(`/api/admin/products/${product.id}`, 'PUT', update), env)
    expect(updatedResponse.status).toBe(200)
    expect(await updatedResponse.json()).toMatchObject({
      product: { imageUrl: '/images/new-cover.jpg', images: ['/images/new-cover.jpg', retained] },
    })
    expect(env.IMAGES.delete).toHaveBeenCalledWith(removed)
    expect(env.IMAGES.delete).not.toHaveBeenCalledWith(`products/${product.id}/retained.png`)
    await worker.fetch(adminRequest(`/api/admin/products/${product.id}`, 'DELETE'), env)
    expect(env.IMAGES.delete).toHaveBeenCalledWith(`products/${product.id}/retained.png`)
  })

  it.each([
    ['/images/1.jpg', '/images/2.jpg', '/images/3.jpg', '/images/4.jpg', '/images/5.jpg', '/images/6.jpg'],
    ['/images/duplicate.jpg', '/images/duplicate.jpg'],
    ['javascript:alert(1)'],
    ['upload:0'],
    ['/api/images/products%2Fanother-product%2Fimage.png'],
  ])('rejects invalid or unowned gallery entries (%j)', async (...entries) => {
    await login()
    const body = new FormData()
    body.set('product', JSON.stringify(productInput))
    body.set('gallery', JSON.stringify(entries))
    const response = await worker.fetch(adminRequest('/api/admin/products', 'POST', body), env)
    expect(response.status).toBe(400)
    expect(records).toHaveLength(0)
    expect(env.IMAGES.put).not.toHaveBeenCalled()
  })

  it('does not allow a published model with an explicitly emptied gallery', async () => {
    await login()
    const body = new FormData()
    body.set('product', JSON.stringify({ ...productInput, imageUrl: '/images/old.jpg', published: true }))
    body.set('gallery', '[]')
    expect((await worker.fetch(adminRequest('/api/admin/products', 'POST', body), env)).status).toBe(400)
  })
})
