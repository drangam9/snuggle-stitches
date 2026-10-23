import { describe, expect, it } from 'vitest'
import { parseProductInput } from './products'

const validProduct = {
  name: 'Iepuraș',
  tag: 'Un dar drag',
  short: 'Urechi pufoase',
  description: 'Un companion lucrat manual.',
  alt: 'Iepuraș croșetat',
  category: 'Animăluțe',
  priceMinRon: 75,
  priceMaxRon: 200,
  imageUrl: '/images/bunny-large.jpg',
  creditAuthor: 'Maker',
  creditUrl: '',
  creditLicense: '',
  published: false,
  sortOrder: 1,
}

describe('product input validation', () => {
  it('accepts a Romanian draft with RON price range and a local concept image', () => {
    expect(parseProductInput(validProduct)).toEqual(validProduct)
  })

  it('rejects malformed objects and missing product content', () => {
    expect(() => parseProductInput(null)).toThrow('Product data must be an object.')
    expect(() => parseProductInput({ ...validProduct, name: ' ' })).toThrow('Add a product name.')
    expect(() => parseProductInput({ ...validProduct, description: '' })).toThrow('Add a product description.')
  })

  it('requires whole, non-negative RON prices with a maximum no lower than the minimum', () => {
    expect(parseProductInput({ ...validProduct, priceMinRon: 120, priceMaxRon: 120 })).toMatchObject({ priceMinRon: 120, priceMaxRon: 120 })
    expect(() => parseProductInput({ ...validProduct, priceMinRon: -1 })).toThrow('Enter a valid minimum price in RON.')
    expect(() => parseProductInput({ ...validProduct, priceMaxRon: 74 })).toThrow('Maximum price must be at least the minimum price.')
    expect(() => parseProductInput({ ...validProduct, priceMinRon: 75.5 })).toThrow('Enter a valid minimum price in RON.')
  })

  it('accepts trimmed custom categories and safe image URLs', () => {
    expect(parseProductInput({ ...validProduct, category: '  Cadouri personalizate  ' }).category).toBe('Cadouri personalizate')
    expect(() => parseProductInput({ ...validProduct, category: ' ' })).toThrow('Enter a category name between 1 and 60 characters.')
    expect(() => parseProductInput({ ...validProduct, category: 'A'.repeat(61) })).toThrow('Enter a category name between 1 and 60 characters.')
    expect(() => parseProductInput({ ...validProduct, imageUrl: 'javascript:alert(1)' })).toThrow('Use an HTTPS image URL or a local /images/ path.')
    expect(() => parseProductInput({ ...validProduct, imageUrl: 'https://images.example.test/bunny.webp' })).not.toThrow()
    expect(() => parseProductInput({ ...validProduct, imageUrl: '/api/images/products%2Fimage-id%2Fversion.webp' })).not.toThrow()
    expect(() => parseProductInput({ ...validProduct, imageUrl: '/api/images/other%2Ffile.webp' })).toThrow()
    expect(() => parseProductInput({ ...validProduct, creditUrl: 'javascript:alert(1)' })).toThrow('Use a valid HTTPS image credit URL.')
  })

  it('rejects published concepts without a usable image', () => {
    expect(() => parseProductInput({ ...validProduct, imageUrl: '', published: true })).toThrow('Add a product image before publishing.')
  })
})
