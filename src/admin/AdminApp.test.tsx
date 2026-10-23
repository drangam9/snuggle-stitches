import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AdminApp from './AdminApp'
import { catalogFixture } from '../test/catalog-fixture'

describe('product admin', () => {
  afterEach(() => {
    sessionStorage.clear()
    vi.unstubAllGlobals()
  })

  it('loads products and saves product and pricing edits through the admin API', async () => {
    const updated = { ...catalogFixture[0], priceMinRon: 95, priceMaxRon: 205 }
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') return new Response(JSON.stringify({ product: updated }), { status: 200 })
      return new Response(JSON.stringify({ products: catalogFixture }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<AdminApp />)

    await screen.findByText('Bonnie, iepurașul')
    await user.click(screen.getByRole('button', { name: 'Editează Bonnie, iepurașul' }))
    await user.clear(screen.getByLabelText('Preț minim (RON)'))
    await user.type(screen.getByLabelText('Preț minim (RON)'), '95')
    await user.click(screen.getByRole('button', { name: 'Salvează modificările' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Model salvat.')
    const updateRequest = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')
    expect(updateRequest).toBeDefined()
    const body = updateRequest?.[1]?.body
    expect(body).toBeInstanceOf(FormData)
    expect(JSON.parse((body as FormData).get('product') as string)).toMatchObject({
      priceMinRon: 95,
      creditAuthor: catalogFixture[0].creditAuthor,
      creditUrl: catalogFixture[0].creditUrl,
      creditLicense: catalogFixture[0].creditLicense,
    })
    expect(fetchMock.mock.calls.every(([, init]) => init?.credentials === 'same-origin')).toBe(true)
  })

  it('hides image-credit fields and saves a custom category', async () => {
    const created = { ...catalogFixture[0], name: 'Cadou personalizat', category: 'Cadouri personalizate' }
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') return new Response(JSON.stringify({ product: created }), { status: 201 })
      return new Response(JSON.stringify({ products: catalogFixture }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<AdminApp />)
    await screen.findByText('Bonnie, iepurașul')
    await user.click(screen.getByRole('button', { name: 'Adaugă un model' }))

    expect(screen.queryByLabelText('Autor / credit imagine')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Link sursă imagine')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Licență imagine')).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Nume model'), created.name)
    await user.type(screen.getByLabelText('Etichetă'), 'Un cadou drag')
    await user.type(screen.getByLabelText('Descriere scurtă'), 'Lucrat cu grijă.')
    await user.type(screen.getByLabelText('Descriere'), 'Un cadou personalizat.')
    await user.type(screen.getByLabelText('Text alternativ pentru imagine'), 'Cadou croșetat.')
    const category = screen.getByRole('combobox', { name: 'Categorie' })
    await user.clear(category)
    await user.type(category, created.category)
    await user.upload(screen.getByLabelText('Imagine produs'), new File(['photo'], 'cadou.png', { type: 'image/png' }))
    await user.click(screen.getByRole('button', { name: 'Adaugă modelul' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Model salvat.')
    const createRequest = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
    const body = createRequest?.[1]?.body as FormData
    expect(JSON.parse(body.get('product') as string).category).toBe('Cadouri personalizate')
  })

  it('opens the collection item editor from its tag and focuses the tag field', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ products: catalogFixture }), { status: 200 })))
    const user = userEvent.setup()
    render(<AdminApp />)
    await screen.findByText('Bonnie, iepurașul')

    await user.click(screen.getByRole('button', { name: 'Editează eticheta: Un mic drăgălaș' }))

    expect(screen.getByRole('heading', { name: 'Editează modelul' })).toBeInTheDocument()
    expect(screen.getByLabelText('Etichetă')).toHaveFocus()
    expect(screen.getByLabelText('Descriere')).toHaveValue(catalogFixture[0].description)
    expect(screen.getByLabelText('Preț minim (RON)')).toHaveValue(75)
  })

  it.each([undefined, 'Modificarea a fost salvată, dar colecția publică poate afișa datele vechi până la 5 minute.'])(
    'persists collection order and displays server warnings (%s)', async (warning) => {
    const reordered = [...catalogFixture].map((product, index) => ({
      ...product,
      sortOrder: index + 1,
    }))
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/admin/products/reorder') {
        const { productIds } = JSON.parse(String(init?.body)) as { productIds: string[] }
        const products = productIds.map((id) => {
          const product = reordered.find((item) => item.id === id)
          return { ...product!, sortOrder: productIds.indexOf(id) + 1 }
        })
        return new Response(JSON.stringify({ products, warning }), { status: 200 })
      }
      return new Response(JSON.stringify({ products: catalogFixture }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<AdminApp />)
    await screen.findByText('Bonnie, iepurașul')

    await user.click(screen.getByRole('button', { name: 'Mută Bonnie, iepurașul mai jos' }))

    const orderRequest = fetchMock.mock.calls.find(([input]) => String(input) === '/api/admin/products/reorder')
    expect(JSON.parse(String(orderRequest?.[1]?.body))).toEqual({
      productIds: [catalogFixture[1].id, catalogFixture[0].id, ...catalogFixture.slice(2).map((product) => product.id)],
    })
    expect(await screen.findByRole('status')).toHaveTextContent(warning ?? 'Ordinea colecției a fost salvată.')
  })

  it('shows login rate-limit errors without authenticating or retrying automatically', async () => {
    const message = 'Prea multe cereri. Așteaptă un minut și încearcă din nou.'
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === 'POST'
        ? new Response(JSON.stringify({ error: message }), { status: 429, headers: { 'retry-after': '60' } })
        : new Response(JSON.stringify({ error: 'Autentificare necesară.' }), { status: 401 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<AdminApp />)
    await user.type(await screen.findByLabelText('Parolă admin'), 'admin-secret')
    await user.click(screen.getByRole('button', { name: 'Autentificare' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.getByLabelText('Parolă admin')).toBeInTheDocument()
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
  })

  it('prompts for the shared password and loads products after login', async () => {
    let authenticated = false
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/admin/session' && init?.method === 'POST') {
        const { password } = JSON.parse(String(init.body)) as { password: string }
        if (password !== 'admin-secret') {
          return new Response(JSON.stringify({ error: 'Parola este incorectă.' }), { status: 401 })
        }
        authenticated = true
        return new Response(JSON.stringify({ authenticated: true }), { status: 200 })
      }
      if (!authenticated) return new Response(JSON.stringify({ error: 'Autentificare necesară.' }), { status: 401 })
      return new Response(JSON.stringify({ products: catalogFixture }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<AdminApp />)

    const password = await screen.findByLabelText('Parolă admin')
    await user.type(password, 'wrong')
    await user.click(screen.getByRole('button', { name: 'Autentificare' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Parola este incorectă.')

    await user.clear(password)
    await user.type(password, 'admin-secret')
    await user.click(screen.getByRole('button', { name: 'Autentificare' }))
    expect(await screen.findByText('Bonnie, iepurașul')).toBeInTheDocument()
  })
})
