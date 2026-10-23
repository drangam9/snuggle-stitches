import { useEffect, useState, type TouchEvent } from 'react'
export function ProductGallery({ images, alt, carousel = false }: { images: string[]; alt: string; carousel?: boolean }) {
  const [index, setIndex] = useState(0)
  const [hovered, setHovered] = useState(false)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const active = index < images.length ? index : 0

  useEffect(() => {
    if (carousel || !hovered || images.length < 2) return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let timer: ReturnType<typeof setInterval> | undefined
    function updateTimer() {
      clearInterval(timer)
      if (!media.matches) timer = setInterval(() => setIndex((current) => (current + 1) % images.length), 1800)
    }
    updateTimer()
    media.addEventListener('change', updateTimer)
    return () => {
      clearInterval(timer)
      media.removeEventListener('change', updateTimer)
    }
  }, [carousel, hovered, images.length])

  function move(direction: number) {
    setIndex((active + direction + images.length) % images.length)
  }

  function endTouch(event: TouchEvent<HTMLDivElement>) {
    if (touchStart !== null && images.length > 1) {
      const distance = event.changedTouches[0].clientX - touchStart
      if (Math.abs(distance) > 40) move(distance < 0 ? 1 : -1)
    }
    setTouchStart(null)
  }

  return (
    <div
      className={`product-gallery${carousel ? ' is-carousel' : ''}`}
      role={carousel ? 'region' : undefined}
      aria-label={carousel ? `Fotografii: ${alt}` : undefined}
      aria-roledescription={carousel ? 'carusel' : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); if (!carousel) setIndex(0) }}
      onTouchStart={carousel ? (event) => setTouchStart(event.touches[0].clientX) : undefined}
      onTouchEnd={carousel ? endTouch : undefined}
      onTouchCancel={() => setTouchStart(null)}
      onKeyDown={carousel ? (event) => {
        if (images.length < 2 || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return
        event.preventDefault()
        event.stopPropagation()
        move(event.key === 'ArrowRight' ? 1 : -1)
      } : undefined}
    >
      {images.length > 0 && <img src={images[active]} alt={alt} width="600" height="600" loading={carousel ? 'eager' : 'lazy'} />}
      {carousel && images.length > 1 && (
        <>
          <div className="gallery-navigation">
            <button type="button" aria-label="Fotografia precedentă" onClick={() => move(-1)}>‹</button>
            <span aria-live="polite" aria-atomic="true">{active + 1} / {images.length}</span>
            <button type="button" aria-label="Fotografia următoare" onClick={() => move(1)}>›</button>
          </div>
          <div className="gallery-thumbnails" aria-label="Alege fotografia">
            {images.map((url, photoIndex) => (
              <button key={url} type="button" aria-label={`Fotografia ${photoIndex + 1}`} aria-pressed={photoIndex === active} onClick={() => setIndex(photoIndex)}>
                <img src={url} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
