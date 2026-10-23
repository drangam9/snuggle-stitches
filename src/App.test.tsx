import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { catalogFixture } from './test/catalog-fixture'

const instagramUrl = 'https://www.instagram.com/snuggle_stitchess/'
const tiktokUrl = 'https://www.tiktok.com/@snuggle.stitchess'

beforeEach(() => {
  window.localStorage.removeItem('snuggle-stitches-theme')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ products: catalogFixture }), { status: 200 }),
  ))
})
afterEach(() => vi.unstubAllGlobals())

describe('Snuggle Stitches showcase', () => {
  it('starts in Romanian with six products and database-driven size-based pricing', async () => {
    render(<App />)
    await screen.findByRole('button', { name: 'Descoperă Bonnie, iepurașul' })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Detalii mici.Bucurii mari.')
    expect(screen.getByText('personal', { selector: '.hero-description em' })).toBeInTheDocument()
    expect(document.querySelector('.hero-description')).toHaveTextContent(/Un dar făcut puțin mai personal pentru cineva drag\./)
    expect(document.body.textContent).not.toMatch(/<\/?em>/)
    expect(screen.getAllByRole('button', { name: /^Descoperă / })).toHaveLength(6)
    expect(screen.getAllByText(/75–200 RON/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Prețul final și disponibilitatea/)).toBeInTheDocument()
  })

  it('previews theme swatches on hover and saves the selected theme', async () => {
    const user = userEvent.setup()
    const view = render(<App />)
    const lavender = screen.getByRole('button', { name: 'Tema lavandă' })
    const sage = screen.getByRole('button', { name: 'Tema salvie' })
    const peach = screen.getByRole('button', { name: 'Tema piersică' })
    const blue = screen.getByRole('button', { name: 'Tema albastru pastel' })

    expect(screen.getAllByRole('button', { name: /^Tema / })).toHaveLength(5)
    expect(lavender).toHaveAttribute('aria-pressed', 'true')
    await user.hover(sage)
    expect(document.documentElement).toHaveAttribute('data-theme', 'sage')
    await user.unhover(sage)
    expect(document.documentElement).toHaveAttribute('data-theme', 'lavender')

    await user.click(peach)
    expect(peach).toHaveAttribute('aria-pressed', 'true')
    expect(window.localStorage.getItem('snuggle-stitches-theme')).toBe('peach')
    await user.tab()
    expect(document.documentElement).toHaveAttribute('data-theme', 'butter')
    await user.tab()
    expect(document.documentElement).toHaveAttribute('data-theme', 'blue')
    await user.tab()
    expect(document.documentElement).toHaveAttribute('data-theme', 'peach')
    await user.hover(blue)
    expect(document.documentElement).toHaveAttribute('data-theme', 'blue')
    await user.unhover(blue)
    expect(document.documentElement).toHaveAttribute('data-theme', 'peach')

    view.unmount()
    render(<App />)
    expect(document.documentElement).toHaveAttribute('data-theme', 'peach')
    expect(screen.getByRole('button', { name: 'Tema piersică' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows the owner’s cropped bunny photo in the hero and keeps the story placeholder', async () => {
    render(<App />)
    await screen.findByRole('button', { name: 'Descoperă Bonnie, iepurașul' })

    expect(screen.getByRole('img', { name: /Iepuraș alb croșetat, în salopetă verde/ })).toHaveAttribute('src', '/images/creatii/iepuras-gradinar-hero.jpg')
    expect(screen.getByRole('img', { name: 'Loc rezervat pentru o fotografie din atelierul Snuggle Stitches.' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Credite foto' })).not.toBeInTheDocument()
    expect(document.querySelector('.hero-photo img')).toHaveAttribute('fetchpriority', 'high')
    expect(document.querySelector('.story-image-wrap > img')).not.toBeInTheDocument()
  })

  it('does not expose an English language switch', async () => {
    render(<App />)
    await screen.findByRole('button', { name: 'Descoperă Bonnie, iepurașul' })
    expect(screen.queryByRole('button', { name: /English|limba/i })).not.toBeInTheDocument()
  })

  it('filters the collection in Romanian without losing access to any design', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('button', { name: 'Descoperă Bonnie, iepurașul' })
    await user.click(screen.getByRole('button', { name: 'De sezon' }))
    expect(screen.getByRole('button', { name: 'De sezon' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('button', { name: /^Descoperă / })).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Descoperă Dovlecel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Descoperă Pip, pinguinul' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Animăluțe' }))
    expect(screen.getAllByRole('button', { name: /^Descoperă / })).toHaveLength(4)
    await user.click(screen.getByRole('button', { name: 'Toate' }))
    expect(screen.getAllByRole('button', { name: /^Descoperă / })).toHaveLength(6)
  })

  it('adds custom product categories to the public filter list', async () => {
    const customProduct = {
      ...catalogFixture[0],
      id: '00000000-0000-4000-8000-000000000007',
      slug: 'cadou-personalizat',
      name: 'Cadou personalizat',
      category: 'Cadouri personalizate',
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ products: [...catalogFixture, customProduct] }), { status: 200 }),
    ))
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('button', { name: 'Descoperă Bonnie, iepurașul' })
    await user.click(screen.getByRole('button', { name: 'Cadouri personalizate' }))

    expect(screen.getByRole('button', { name: 'Cadouri personalizate' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('button', { name: /^Descoperă / })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Descoperă Cadou personalizat' })).toBeInTheDocument()
  })

  it('shows prices from the database response rather than a hardcoded range', async () => {
    const products = catalogFixture.map((product, index) => ({
      ...product,
      priceMinRon: 90,
      priceMaxRon: index === 0 ? 130 : 140,
    }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ products }), { status: 200 }),
    ))
    render(<App />)
    await screen.findByRole('button', { name: 'Descoperă Bonnie, iepurașul' })
    expect(document.querySelector('.collection-price')).toHaveTextContent('90–140 RON')
    expect(screen.getByText('90–130 RON', { selector: '.design-price' })).toBeInTheDocument()
  })

  it('shows an explicit empty state when no products are published', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ products: [] }), { status: 200 }),
    ))
    render(<App />)
    expect(await screen.findByText('Pregătim primele modele.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Descoperă / })).not.toBeInTheDocument()
  })

  it('surfaces catalogue errors and allows a retry', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ products: catalogFixture }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: 'Încearcă din nou' }))
    expect(await screen.findByRole('button', { name: 'Descoperă Bonnie, iepurașul' })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    errorSpy.mockRestore()
  })

  it('keeps the selected design through contact and shows both real profile links', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('button', { name: 'Descoperă Bonnie, iepurașul' })
    await user.click(screen.getByRole('button', { name: 'Descoperă Bonnie, iepurașul' }))
    const dialog = screen.getByRole('dialog', { name: 'Bonnie, iepurașul' })
    expect(within(dialog).getByText(/75–200 RON/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /Hai să vorbim despre model/ }))
    const contactDialog = screen.getByRole('dialog', { name: 'Hai să facem o bucurie.' })
    expect(within(contactDialog).getByText(/Îmi place modelul Bonnie, iepurașul/)).toBeInTheDocument()
    expect(within(contactDialog).getByRole('link', { name: 'Profilul Snuggle Stitches pe Instagram (se deschide într-o filă nouă)' }))
      .toHaveAttribute('href', instagramUrl)
    expect(within(contactDialog).getByRole('link', { name: 'Profilul Snuggle Stitches pe TikTok (se deschide într-o filă nouă)' }))
      .toHaveAttribute('href', tiktokUrl)
    await user.click(screen.getByRole('button', { name: /Înapoi la Bonnie/ }))
    expect(screen.getByRole('dialog', { name: 'Bonnie, iepurașul' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Închide fereastra' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('provides real Instagram and TikTok links on the landing page', () => {
    render(<App />)
    expect(screen.getByRole('link', { name: 'Profilul Snuggle Stitches pe Instagram (se deschide într-o filă nouă)' }))
      .toHaveAttribute('href', instagramUrl)
    expect(screen.getByRole('link', { name: 'Profilul Snuggle Stitches pe TikTok (se deschide într-o filă nouă)' }))
      .toHaveAttribute('href', tiktokUrl)
    expect(screen.getByRole('link', { name: 'Profilul Snuggle Stitches pe Instagram (se deschide într-o filă nouă)' }))
      .toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('opens contact from the navigation and links to both social profiles', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('button', { name: 'Descoperă Bonnie, iepurașul' })
    await user.click(screen.getByRole('button', { name: 'Hai să vorbim' }))
    const dialog = screen.getByRole('dialog', { name: 'Hai să facem o bucurie.' })
    expect(dialog).toHaveTextContent(/deschide contul Snuggle Stitches/)
    expect(within(dialog).getByRole('link', { name: 'Profilul Snuggle Stitches pe Instagram (se deschide într-o filă nouă)' }))
      .toHaveAttribute('href', instagramUrl)
    expect(within(dialog).getByRole('link', { name: 'Profilul Snuggle Stitches pe TikTok (se deschide într-o filă nouă)' }))
      .toHaveAttribute('href', tiktokUrl)
  })

  it('shows source credits with each borrowed inspiration photo', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('button', { name: 'Descoperă Bonnie, iepurașul' })
    await user.click(screen.getByRole('button', { name: 'Descoperă Bonnie, iepurașul' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('link', { name: 'CC BY-SA 4.0' })).toHaveAttribute(
      'href',
      'https://creativecommons.org/licenses/by-sa/4.0/',
    )
    expect(within(dialog).getByText(/Creativa Atelier/)).toBeInTheDocument()
  })
})
