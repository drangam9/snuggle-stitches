import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProductGallery } from './ProductGallery'
import { productImages } from '../worker/products'

const images = ['/images/one.jpg', '/images/two.jpg', '/images/three.jpg']

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('product gallery', () => {
  it('cycles all images only while hovered and resets to the cover on leave', () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    const { container, unmount } = render(<ProductGallery images={images} alt="Model" />)
    const image = screen.getByRole('img', { name: 'Model' })
    act(() => vi.advanceTimersByTime(1800))
    expect(image).toHaveAttribute('src', images[0])
    fireEvent.mouseEnter(container.firstChild!)
    for (const expected of [images[1], images[2], images[0]]) {
      act(() => vi.advanceTimersByTime(1800))
      expect(image).toHaveAttribute('src', expected)
    }
    fireEvent.mouseLeave(container.firstChild!)
    expect(image).toHaveAttribute('src', images[0])
    expect(vi.getTimerCount()).toBe(0)
    fireEvent.mouseEnter(container.firstChild!)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not auto-cycle when reduced motion is preferred', () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    const { container } = render(<ProductGallery images={images} alt="Model" />)
    fireEvent.mouseEnter(container.firstChild!)
    act(() => vi.advanceTimersByTime(10000))
    expect(screen.getByRole('img', { name: 'Model' })).toHaveAttribute('src', images[0])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('supports carousel arrows, wraparound, thumbnails, keyboard and swiping', () => {
    render(<ProductGallery images={images} alt="Model" carousel />)
    const image = screen.getByRole('img', { name: 'Model' })
    fireEvent.click(screen.getByRole('button', { name: 'Fotografia precedentă' }))
    expect(image).toHaveAttribute('src', images[2])
    fireEvent.click(screen.getByRole('button', { name: 'Fotografia următoare' }))
    expect(image).toHaveAttribute('src', images[0])
    fireEvent.click(screen.getByRole('button', { name: 'Fotografia 2' }))
    expect(image).toHaveAttribute('src', images[1])
    const region = screen.getByRole('region')
    fireEvent.keyDown(region, { key: 'ArrowRight' })
    expect(image).toHaveAttribute('src', images[2])
    fireEvent.touchStart(region, { touches: [{ clientX: 180 }] })
    fireEvent.touchEnd(region, { changedTouches: [{ clientX: 80 }] })
    expect(image).toHaveAttribute('src', images[0])
  })

  it('keeps single-photo models simple and supports legacy covers', () => {
    render(<ProductGallery images={[images[0]]} alt="Model" carousel />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(productImages({ imageUrl: images[0] })).toEqual([images[0]])
  })
})
