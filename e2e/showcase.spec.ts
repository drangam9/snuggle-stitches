import { expect, test } from '@playwright/test'
import { catalogFixture } from '../src/test/catalog-fixture'

const instagramUrl = 'https://www.instagram.com/snuggle_stitchess/'
const tiktokUrl = 'https://www.tiktok.com/@snuggle.stitchess'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/products', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ products: catalogFixture }),
  }))
  await page.goto('/')
})

test('shows the personal bunny hero and loads catalogue images without horizontal overflow', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.reload()
  await page.evaluate(() => document.fonts.ready)
  for (const image of await page.locator('main img').all()) {
    await image.scrollIntoViewIfNeeded()
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true)
  }
  await expect(page).toHaveTitle('Snuggle Stitches | Detalii mici. Bucurii mari.')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ro')
  await expect(page.getByRole('img', { name: /Iepuraș alb croșetat, în salopetă verde/ })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Loc rezervat pentru o fotografie din atelierul Snuggle Stitches.' })).toBeVisible()
  await expect(page.locator('.hero-photo img')).toHaveCount(1)
  await expect(page.locator('.story-image-wrap > img')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Credite foto' })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  const storyPlaceholder = await page.locator('.story-image-placeholder').boundingBox()
  expect(storyPlaceholder && storyPlaceholder.width / storyPlaceholder.height).toBeCloseTo(1.1, 1)
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }))
  await page.screenshot({ path: testInfo.outputPath('landing.png'), fullPage: true })
  expect(errors).toEqual([])
})

test('keeps the site Romanian and does not show a language selector', async ({ page }) => {
  await expect(page.locator('html')).toHaveAttribute('lang', 'ro')
  await expect(page).toHaveTitle('Snuggle Stitches | Detalii mici. Bucurii mari.')
  await expect(page.getByRole('button', { name: /English|limba/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Descoperă Bonnie, iepurașul' })).toBeVisible()
})

test('filters all six Romanian designs into animal and seasonal collections', async ({ page }) => {
  await expect(page.getByRole('button', { name: /^Descoperă / })).toHaveCount(6)
  await page.getByRole('button', { name: 'De sezon' }).click()
  await expect(page.getByRole('button', { name: /^Descoperă / })).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'De sezon' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Animăluțe' }).click()
  await expect(page.getByRole('button', { name: /^Descoperă / })).toHaveCount(4)
  await page.getByRole('button', { name: 'Toate' }).click()
  await expect(page.getByRole('button', { name: /^Descoperă / })).toHaveCount(6)
})

test('filters products by a custom category from the catalogue API', async ({ page }) => {
  await page.route('**/api/products', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      products: [
        ...catalogFixture,
        {
          ...catalogFixture[0],
          id: '00000000-0000-4000-8000-000000000007',
          slug: 'cadou-personalizat',
          name: 'Cadou personalizat',
          category: 'Cadouri personalizate',
        },
      ],
    }),
  }))
  await page.reload()

  await page.getByRole('button', { name: 'Cadouri personalizate' }).click()
  await expect(page.getByRole('button', { name: /^Descoperă / })).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Descoperă Cadou personalizat' })).toBeVisible()
})

test('shows fixed pricing and a controllable photo carousel, with hover cycling in the collection', async ({ page }, testInfo) => {
  const images = ['/images/bunny-large.jpg', '/images/bear.jpg', '/images/fox.jpg']
  await page.route('**/api/products', (route) => route.fulfill({
    json: { products: [{ ...catalogFixture[0], images, priceMinRon: 120, priceMaxRon: 120 }] },
  }))
  await page.reload()
  const card = page.getByRole('button', { name: 'Descoperă Bonnie, iepurașul' })
  const cardImage = card.getByRole('img')
  await expect(card.locator('.design-price')).toHaveText('120 RON')
  if (testInfo.project.name === 'desktop') {
    await cardImage.hover()
    await expect(cardImage).toHaveAttribute('src', images[1], { timeout: 4000 })
    await expect(cardImage).toHaveAttribute('src', images[2], { timeout: 4000 })
    await page.mouse.move(0, 0)
    await expect(cardImage).toHaveAttribute('src', images[0])
  }
  await card.click()
  const dialog = page.getByRole('dialog', { name: 'Bonnie, iepurașul' })
  const photo = dialog.locator('.product-gallery > img')
  await expect(photo).toHaveAttribute('src', images[0])
  await expect(dialog.locator('.detail-pricing')).toHaveText('120 RON')
  await dialog.getByRole('button', { name: 'Fotografia următoare' }).click()
  await expect(photo).toHaveAttribute('src', images[1])
  await page.keyboard.press('ArrowRight')
  await expect(photo).toHaveAttribute('src', images[2])
  await dialog.getByRole('button', { name: 'Fotografia 1', exact: true }).click()
  await expect(photo).toHaveAttribute('src', images[0])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('product-gallery.png') })
})

test('previews yarn color themes on hover and remembers a clicked theme', async ({ page }) => {
  const sage = page.getByRole('button', { name: 'Tema salvie' })
  const peach = page.getByRole('button', { name: 'Tema piersică' })
  await expect(page.getByRole('group', { name: 'Alege o temă de culoare' }).getByRole('button')).toHaveCount(5)

  await sage.hover()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sage')
  await expect(page.locator('.announcement')).toHaveCSS('background-color', 'rgb(220, 228, 213)')
  await page.mouse.move(1, 1)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'lavender')

  await peach.click()
  await expect(peach).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'peach')
  await expect(page.locator('.announcement')).toHaveCSS('background-color', 'rgb(241, 214, 201)')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'peach')
  await expect(page.getByRole('button', { name: 'Tema piersică' })).toHaveAttribute('aria-pressed', 'true')
})

test('animates decorative doodles gently and repeats the motion on hover', async ({ page }) => {
  const heroSpark = page.locator('.hero-spark')
  await expect(heroSpark).toHaveCSS('animation-name', 'gentle-float')
  await expect(heroSpark).toHaveCSS('animation-iteration-count', 'infinite')

  await page.locator('.hero-visual').hover()
  await expect(heroSpark).toHaveCSS('animation-name', 'sparkle-twinkle')

  const squiggle = page.locator('.swatch-card > .doodle')
  await page.locator('.swatch-card').hover()
  await expect(squiggle).toHaveCSS('animation-name', 'squiggle-wiggle')

  const connectors = page.locator('.step-connector-track')
  await expect(connectors).toHaveCount(2)
  await expect(connectors.first()).toHaveCSS('animation-name', 'none')
  await page.locator('.steps article').first().hover()
  await expect(page.locator('.step-number svg').first()).toHaveCSS('animation-name', 'step-icon-pop')

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(heroSpark).toHaveCSS('animation-name', 'none')
  await expect(squiggle).toHaveCSS('animation-name', 'none')
})

test('traps dialog focus, closes with Escape, and returns focus to the design', async ({ page }) => {
  const opener = page.getByRole('button', { name: 'Descoperă Bonnie, iepurașul' })
  await opener.click()
  const dialog = page.getByRole('dialog', { name: 'Bonnie, iepurașul' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Bonnie, iepurașul' })).toBeFocused()
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')
  for (let step = 0; step < 12; step++) {
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => document.activeElement?.closest('dialog') !== null)).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(opener).toBeFocused()
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
})

test('keeps the selected design through contact, with both real profile links', async ({ page }) => {
  await page.getByRole('button', { name: 'Descoperă Bonnie, iepurașul' }).click()
  await page.getByRole('button', { name: /Hai să vorbim despre model/ }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Îmi place modelul Bonnie, iepurașul')
  const instagram = dialog.getByRole('link', { name: 'Profilul Snuggle Stitches pe Instagram (se deschide într-o filă nouă)' })
  const tiktok = dialog.getByRole('link', { name: 'Profilul Snuggle Stitches pe TikTok (se deschide într-o filă nouă)' })
  await expect(instagram).toHaveAttribute('href', instagramUrl)
  await expect(instagram).toHaveAttribute('target', '_blank')
  await expect(instagram).toHaveAttribute('rel', 'noopener noreferrer')
  await expect(tiktok).toHaveAttribute('href', tiktokUrl)
  await expect(tiktok).toHaveAttribute('target', '_blank')
  await page.getByRole('button', { name: /Înapoi la Bonnie/ }).click()
  await expect(page.getByRole('dialog', { name: 'Bonnie, iepurașul' })).toBeVisible()
  await page.getByRole('button', { name: 'Închide fereastra' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('links directly to the owner’s social profiles on the page', async ({ page }) => {
  await expect(page.getByRole('link', { name: 'Profilul Snuggle Stitches pe Instagram (se deschide într-o filă nouă)' }))
    .toHaveAttribute('href', instagramUrl)
  await expect(page.getByRole('link', { name: 'Profilul Snuggle Stitches pe TikTok (se deschide într-o filă nouă)' }))
    .toHaveAttribute('href', tiktokUrl)
})

test('opens contact from the header and dismisses the dialog from the backdrop', async ({ page }) => {
  if (test.info().project.name === 'mobile') await page.locator('[aria-controls="main-navigation"]').click()
  await page.getByRole('button', { name: 'Hai să vorbim' }).click()
  const dialog = page.getByRole('dialog', { name: 'Hai să facem o bucurie.' })
  await expect(dialog).toContainText('deschide contul Snuggle Stitches')
  await page.mouse.click(2, 2)
  await expect(dialog).toHaveCount(0)
})

test('supports the mobile navigation menu', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile') {
    const menu = page.locator('[aria-controls="main-navigation"]')
    await menu.click()
    await expect(menu).toHaveAttribute('aria-expanded', 'true')
    await page.getByRole('link', { name: 'Pe gustul tău' }).click()
    await expect(menu).toHaveAttribute('aria-expanded', 'false')
  }
})

test('fits narrow phones and intermediate tablet widths', async ({ page }) => {
  await page.evaluate(() => document.fonts.ready)
  for (const width of [320, 375, 600, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `Overflow at ${width}px`).toBeLessThanOrEqual(width)
  }
})
