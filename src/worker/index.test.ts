import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from './env'
import worker from './index'
import type { ProductInput, ProductRecord } from './products'

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
          return (records.find((record) => record.id === id) ?? null) as T | null
        },
        async run() {
          if (query.startsWith('INSERT INTO products')) {
            const [
              id, slug, name, tag, short, description, alt, category,
              price_min_ron, price_max_ron, image_key, image_url, credit_author,
              credit_url, credit_license, is_published, sort_order,
            ] = values
            records.push({
              id: String(id), slug: String(slug), name: String(name), tag: String(tag), short: String(short),
              description: String(description), alt: String(alt), category: category as ProductRecord['category'],
              price_min_ron: Number(price_min_ron), price_max_ron: Number(price_max_ron),
              image_key: image_key as string | null, image_url: image_url as string | null,
              credit_author: String(credit_author), credit_url: String(credit_url), credit_license: String(credit_license),
              is_published: Number(is_published), sort_order: Number(sort_order),
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
              credit_url, credit_license, is_published, sort_order,
            ] = values
            Object.assign(record, {
              slug, name, tag, short, description, alt, category,
              price_min_ron, price_max_ron, image_key, image_url, credit_author,
              credit_url, credit_license, is_published, sort_order,
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
  }
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
    adminCookie = `${adminCookie?.slice(0, -1)}x`
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

    const publicResponse = await worker.fetch(new Request('https://shop.test/api/products'), env)
    expect((await publicResponse.json() as { products: unknown[] }).products).toHaveLength(0)
    const adminResponse = await worker.fetch(adminRequest('/api/admin/products'), env)
    expect((await adminResponse.json() as { products: unknown[] }).products).toHaveLength(1)

    const updateBody = new FormData()
    updateBody.set('product', JSON.stringify({ ...productInput, priceMinRon: 90, priceMaxRon: 210 }))
    const updatedResponse = await worker.fetch(adminRequest(`/api/admin/products/${created.id}`, 'PUT', updateBody), env)
    expect(updatedResponse.status).toBe(200)
    expect((await updatedResponse.json() as { product: { priceMinRon: number; priceMaxRon: number } }).product)
      .toMatchObject({ priceMinRon: 90, priceMaxRon: 210 })

    const deletedResponse = await worker.fetch(adminRequest(`/api/admin/products/${created.id}`, 'DELETE'), env)
    expect(deletedResponse.status).toBe(200)
    expect((await deletedResponse.json() as { deleted: boolean }).deleted).toBe(true)
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
  })
})
