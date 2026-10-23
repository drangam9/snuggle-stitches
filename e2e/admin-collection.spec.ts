import { expect, test } from '@playwright/test'
import { catalogFixture } from '../src/test/catalog-fixture'

test.beforeEach(async ({ page }) => {
  let products = [...catalogFixture]
  await page.route('**/api/admin/products/reorder', async (route) => {
    const { productIds } = route.request().postDataJSON() as { productIds: string[] }
    const byId = new Map(products.map((product) => [product.id, product]))
    products = productIds.flatMap((id, index) => {
      const product = byId.get(id)
      return product ? [{ ...product, sortOrder: index + 1 }] : []
    })
    await route.fulfill({ json: { products } })
  })
  await page.route('**/api/admin/products', (route) => route.fulfill({ json: { products } }))
  await page.goto('/admin.html')
})

test('opens matching item details from a card tag for direct editing', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Noul tău prieten drag.' })).toBeVisible()
  await expect(page.locator('.admin-design-grid .design-card')).toHaveCount(catalogFixture.length)
  await expect(page.locator('main section')).toHaveCount(1)

  await page.getByRole('button', { name: 'Editează eticheta: Un mic drăgălaș' }).click()

  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByLabel('Etichetă')).toBeFocused()
  await expect(page.locator('.admin-item-fields textarea')).toHaveValue(catalogFixture[0].description)
  await expect(page.getByLabel('Preț minim (RON)')).toHaveValue('75')
})

test('reorders collection cards and persists the order', async ({ page }) => {
  const cardNames = page.locator('.admin-design-grid .design-card h3')
  await expect(cardNames.first()).toHaveText(catalogFixture[0].name)

  await page.getByRole('button', { name: `Mută ${catalogFixture[0].name} mai jos` }).click()

  await expect(page.getByRole('status')).toHaveText('Ordinea colecției a fost salvată.')
  await expect(cardNames.nth(0)).toHaveText(catalogFixture[1].name)
  await expect(cardNames.nth(1)).toHaveText(catalogFixture[0].name)
})

test('supports dragging a card to a new collection position', async ({ page }) => {
  const cardNames = page.locator('.admin-design-grid .design-card h3')
  await page.getByRole('button', { name: `Trage pentru a reordona ${catalogFixture[1].name}` })
    .dragTo(page.locator('.admin-design-grid .design-card').first())

  await expect(page.getByRole('status')).toHaveText('Ordinea colecției a fost salvată.')
  await expect(cardNames.first()).toHaveText(catalogFixture[1].name)
  await expect(cardNames.nth(1)).toHaveText(catalogFixture[0].name)
})

test('opens a new item editor with a required image upload', async ({ page }) => {
  await page.getByRole('button', { name: 'Adaugă un model' }).click()

  const imageInput = page.getByLabel('Imagine produs')
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(imageInput).toHaveAttribute('required', '')
  await imageInput.setInputFiles({
    name: 'plush.png',
    mimeType: 'image/png',
    buffer: Buffer.from('preview image'),
  })

  await expect(page.locator('.admin-photo-list li')).toHaveCount(1)
  await expect(page.locator('.admin-item-photo .product-gallery > img')).toHaveAttribute('src', /^blob:/)
  await expect(imageInput).not.toHaveAttribute('required', '')
})

test('edits fixed pricing and reorders or removes gallery photos', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: `Editează ${catalogFixture[0].name}`, exact: true }).click()
  await page.getByLabel('Tip preț').selectOption('fixed')
  await expect(page.getByLabel('Preț maxim (RON)')).toHaveCount(0)
  await page.getByLabel('Preț (RON)').fill('120')
  const buffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64')
  await page.getByLabel('Imagine produs').setInputFiles([
    { name: 'first.png', mimeType: 'image/png', buffer },
    { name: 'second.png', mimeType: 'image/png', buffer },
  ])
  await expect(page.locator('.admin-photo-list li')).toHaveCount(3)
  const thirdPhoto = await page.locator('.admin-photo-list li img').nth(2).getAttribute('src')
  await page.getByRole('button', { name: 'Trage fotografia 3', exact: true }).dragTo(page.locator('.admin-photo-list li').first())
  await expect(page.locator('.admin-photo-list li img').first()).toHaveAttribute('src', thirdPhoto!)
  await page.getByRole('button', { name: 'Mută fotografia 1 mai jos' }).click()
  await page.getByRole('button', { name: 'Mută fotografia 2 mai sus' }).click()
  await page.getByRole('button', { name: 'Șterge fotografia 3' }).click()
  await expect(page.locator('.admin-photo-list li')).toHaveCount(2)
  await expect(page.locator('.admin-photo-list li').first()).toContainText('Copertă')
  await expect(page.locator('.admin-photo-list li img').first()).toHaveAttribute('src', /^blob:/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('admin-gallery.png') })
})
