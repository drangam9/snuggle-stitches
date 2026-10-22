import { useEffect, useLayoutEffect, useState } from 'react'
import { Dialog } from './components/Dialog'
import { Doodle, Icon } from './components/Graphics'
import { translations } from './i18n'
import type { ProductRow } from './worker/products'
import './App.css'

type CatalogProduct = ProductRow & { tone: string }
type Modal = { view: 'design'; design: ProductRow } | { view: 'contact'; design?: ProductRow }
type SocialProfile = 'instagram' | 'tiktok'
type CatalogPayload = { products: ProductRow[] }
type CatalogStatus = 'loading' | 'error' | 'ready'
type ColorTheme = 'lavender' | 'sage' | 'peach' | 'butter' | 'blue'

const socialProfiles = {
  instagram: 'https://www.instagram.com/snuggle_stitchess/',
  tiktok: 'https://www.tiktok.com/@snuggle.stitchess',
} as const
const stepIcons = ['heart', 'chat', 'gift'] as const
const conceptYear = new Date().getFullYear()
const cardTones = ['peach', 'butter', 'sage', 'lavender', 'blue']
const colorThemes: { id: ColorTheme; label: string }[] = [
  { id: 'lavender', label: 'lavandă' },
  { id: 'sage', label: 'salvie' },
  { id: 'peach', label: 'piersică' },
  { id: 'butter', label: 'galben unt' },
  { id: 'blue', label: 'albastru pastel' },
]
const themeStorageKey = 'snuggle-stitches-theme'

function isColorTheme(value: string | null): value is ColorTheme {
  return colorThemes.some((theme) => theme.id === value)
}

function getSavedTheme(): ColorTheme {
  try {
    const savedTheme = window.localStorage.getItem(themeStorageKey)
    return isColorTheme(savedTheme) ? savedTheme : 'lavender'
  } catch (error) {
    console.error('Tema salvată nu a putut fi citită din browser.', error)
    return 'lavender'
  }
}

function formatPriceRange(min: number, max: number) {
  return min === max ? `${min} RON` : `${min}–${max} RON`
}

function App() {
  const [filter, setFilter] = useState<string | null>(null)
  const [modal, setModal] = useState<Modal | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [selectedTheme, setSelectedTheme] = useState<ColorTheme>(getSavedTheme)
  const [hoveredTheme, setHoveredTheme] = useState<ColorTheme | null>(null)
  const [focusedTheme, setFocusedTheme] = useState<ColorTheme | null>(null)
  const [themeSaveError, setThemeSaveError] = useState(false)
  const [products, setProducts] = useState<ProductRow[]>([])
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus>('loading')
  const [catalogAttempt, setCatalogAttempt] = useState(0)
  const copy = translations.ro
  const catalogDesigns: CatalogProduct[] = products.map((product, index) => ({
    ...product,
    tone: cardTones[index % cardTones.length],
  }))
  const categories = [...new Set(catalogDesigns.map((design) => design.category))]
  const visibleDesigns = catalogDesigns.filter(
    (design) => filter === null || design.category === filter,
  )
  const collectionPrice = visibleDesigns.length
    ? formatPriceRange(
      Math.min(...visibleDesigns.map((design) => design.priceMinRon)),
      Math.max(...visibleDesigns.map((design) => design.priceMaxRon)),
    )
    : ''
  const selectedDesign = modal?.view === 'design'
    ? catalogDesigns.find((design) => design.id === modal.design.id)
    : modal?.view === 'contact' && modal.design
      ? catalogDesigns.find((design) => design.id === modal.design?.id)
      : undefined
  const contactDesign = modal?.view === 'contact' ? modal.design : undefined
  const modalTitle = modal?.view === 'design'
    ? selectedDesign?.name ?? ''
    : copy.contact.modalTitle
  const activeTheme = focusedTheme ?? hoveredTheme ?? selectedTheme

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = activeTheme
    return () => {
      if (document.documentElement.dataset.theme === activeTheme) {
        delete document.documentElement.dataset.theme
      }
    }
  }, [activeTheme])

  useEffect(() => {
    let active = true
    fetch('/api/products')
      .then(async (response) => {
        if (!response.ok) throw new Error(`Product catalogue request failed with status ${response.status}.`)
        const payload: unknown = await response.json()
        if (
          typeof payload !== 'object' || payload === null || !('products' in payload) ||
          !Array.isArray(payload.products)
        ) {
          throw new Error('Product catalogue response has an invalid format.')
        }
        return payload as CatalogPayload
      })
      .then((payload) => {
        if (!active) return
        setProducts(payload.products)
        setCatalogStatus('ready')
      })
      .catch((error: unknown) => {
        console.error('Public product catalogue request failed.', error)
        if (active) setCatalogStatus('error')
      })
    return () => { active = false }
  }, [catalogAttempt])

  function openContact(design?: ProductRow) {
    setMenuOpen(false)
    setModal({ view: 'contact', design })
  }

  function retryCatalog() {
    setCatalogStatus('loading')
    setCatalogAttempt((attempt) => attempt + 1)
  }

  function selectTheme(theme: ColorTheme) {
    setSelectedTheme(theme)
    try {
      window.localStorage.setItem(themeStorageKey, theme)
      setThemeSaveError(false)
    } catch (error) {
      console.error('Tema a fost schimbată, dar preferința nu a putut fi salvată.', error)
      setThemeSaveError(true)
    }
  }

  function profileLink(profile: SocialProfile) {
    return (
      <a
        className={`button ${profile === 'tiktok' ? 'button-light' : ''}`}
        href={socialProfiles[profile]}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={copy.contact[profile === 'instagram' ? 'instagramProfile' : 'tiktokProfile']}
      >
        {profile === 'instagram' ? <Icon name="instagram" size={20} /> : <Icon name="tiktok" size={20} />}
        {copy.contact[profile]}
        <Icon name="arrow-up" size={17} />
      </a>
    )
  }

  function renderPhotoCredit(design: CatalogProduct) {
    if (!design.creditAuthor || !design.creditUrl) return null
    const licenseUrl = design.creditLicense === 'CC BY-SA 4.0'
      ? 'https://creativecommons.org/licenses/by-sa/4.0/'
      : design.creditLicense === 'CC BY-SA 3.0'
        ? 'https://creativecommons.org/licenses/by-sa/3.0/'
        : undefined
    return (
      <p className="photo-credit">
        {copy.hero.imageCredit} <a href={design.creditUrl} target="_blank" rel="noreferrer">{design.creditAuthor}</a>
        {licenseUrl && <> / <a href={licenseUrl} target="_blank" rel="noreferrer">{design.creditLicense}</a></>}.
      </p>
    )
  }

  return (
    <>
      <a className="skip-link" href="#main">{copy.skipToContent}</a>
      <div className="announcement">
        {copy.announcement} <Icon name="heart" size={13} />
      </div>

      <header className="site-header">
        <div className="container header-inner">
          <a className="brand" href="#" aria-label={copy.brandLabel}>
            <Doodle kind="yarn" className="brand-mark" />
            <span>snuggle<span className="brand-second">stitches<span className="brand-dot">.</span></span></span>
          </a>
          <button
            className="menu-toggle icon-button"
            aria-label={menuOpen ? copy.navigation.close : copy.navigation.open}
            aria-expanded={menuOpen}
            aria-controls="main-navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} />
          </button>
          <nav id="main-navigation" className={menuOpen ? 'navigation is-open' : 'navigation'} aria-label={copy.navigation.label}>
            <a href="#collection" onClick={() => setMenuOpen(false)}>{copy.navigation.collection}</a>
            <a href="#personalize" onClick={() => setMenuOpen(false)}>{copy.navigation.personal}</a>
            <a href="#story" onClick={() => setMenuOpen(false)}>{copy.navigation.story}</a>
            <button className="button button-small" onClick={() => openContact()}>
              {copy.navigation.contact} <Icon name="arrow-up" size={17} />
            </button>
          </nav>
        </div>
      </header>

      <main id="main">
        <section className="hero container" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow"><span className="little-dot" /> {copy.hero.eyebrow}</p>
            <h1 id="hero-title">{copy.hero.firstLine}<br /><span className="smiles">{copy.hero.secondLine}<svg viewBox="0 0 400 23" aria-hidden="true"><path d="M4 14Q95-2 195 12T394 9M28 21Q190 6 355 19" /></svg></span></h1>
            <p className="hero-description">{copy.hero.descriptionBefore}<em>{copy.hero.descriptionEmphasis}</em>{copy.hero.descriptionAfter}</p>
            <div className="hero-actions">
              <a className="button" href="#collection">{copy.hero.collectionAction} <Icon name="arrow" size={19} /></a>
              <a className="text-link" href="#how-it-works">{copy.hero.howAction} <Icon name="arrow-down" size={16} /></a>
            </div>
            <div className="hero-note">
              <span className="note-heart"><Icon name="heart" size={20} /></span>
              <span>{copy.hero.note} <strong>{copy.hero.noteStrong}</strong></span>
            </div>
          </div>

          <div className="hero-visual">
            <Doodle kind="spark" className="hero-spark" />
            <div className="hero-photo">
              <div className="photo-grid" />
              <span className="hero-photo-label">{copy.hero.imageLabel}</span>
              <div className="hero-image-placeholder" role="img" aria-label={copy.hero.imagePlaceholder}>
                <span>{copy.hero.imagePlaceholder}</span>
              </div>
              <Doodle kind="flower" className="photo-flower" />
              <div className="gift-decoration" aria-hidden="true"><Icon name="gift" size={58} /><span>{copy.hero.giftLabel}</span></div>
            </div>
            <div className="handmade-sticker"><Icon name="heart" size={19} /><span>{copy.hero.stickerFirst}<br />{copy.hero.stickerSecond}</span><span className="sticker-tiny">{copy.hero.stickerTiny}</span></div>
            <div className="hero-annotation"><Doodle kind="arrow" /><span>{copy.hero.annotation}</span></div>
          </div>
        </section>

        <div className="values-ribbon" aria-label={copy.ribbon.label}>
          <div className="container ribbon-inner">
            {copy.ribbon.phrases.map((phrase, index) => (
              <span key={phrase} className={index === 3 ? 'ribbon-extra' : undefined}>
                {phrase}{index < copy.ribbon.phrases.length - 1 && <Doodle kind="spark" />}
              </span>
            ))}
          </div>
        </div>

        <section id="collection" className="collection section container" aria-labelledby="collection-title">
          <div className="section-heading">
            <p className="eyebrow">{copy.collection.eyebrow}</p>
            <h2 id="collection-title">{copy.collection.titleFirst} <em>{copy.collection.titleSecond}</em></h2>
            <p>{copy.collection.descriptionFirst}<br className="desktop-break" /> {copy.collection.descriptionSecond}</p>
          </div>
          <div className="collection-toolbar">
            <div className="filters" role="group" aria-label={copy.collection.filterLabel}>
              <button className={filter === null ? 'filter is-active' : 'filter'} aria-pressed={filter === null} onClick={() => setFilter(null)}>
                <Icon name="spark" size={15} />{copy.collection.filters.all}
              </button>
              {categories.map((category) => (
                <button key={category} className={filter === category ? 'filter is-active' : 'filter'} aria-pressed={filter === category} onClick={() => setFilter(category)}>
                  {category}
                </button>
              ))}
            </div>
            {catalogStatus === 'ready' && collectionPrice && <p className="collection-price">{collectionPrice} <span>/ {copy.collection.priceQualifier}</span></p>}
          </div>
          <p className="sr-only" role="status">{catalogStatus === 'ready' ? copy.collection.count(visibleDesigns.length) : ''}</p>
          {catalogStatus === 'loading' ? (
            <p className="catalog-message" role="status">{copy.collection.loading}</p>
          ) : catalogStatus === 'error' ? (
            <div className="catalog-message" role="alert">
              <p>{copy.collection.loadError}</p>
              <button className="text-link" onClick={retryCatalog}>{copy.collection.retry} <Icon name="arrow" size={18} /></button>
            </div>
          ) : visibleDesigns.length === 0 ? (
            products.length === 0 ? (
              <div className="catalog-message catalog-empty">
                <h3>{copy.collection.emptyTitle}</h3>
                <p>{copy.collection.emptyMessage}</p>
              </div>
            ) : (
              <p className="catalog-message">{copy.collection.count(0)}</p>
            )
          ) : (
            <div className="design-grid">
              {visibleDesigns.map((design) => (
                <article className={`design-card ${design.tone}`} key={design.id}>
                  <button className="design-open" aria-label={`${copy.collection.designAction} ${design.name}`} onClick={() => setModal({ view: 'design', design })}>
                    <div className="design-image">
                      <span className="design-tag">{design.tag}</span>
                      <img src={design.imageUrl} alt={design.alt} width="600" height="600" loading="lazy" />
                      <span className="design-image-action">{copy.collection.closerLook} <Icon name="plus" size={16} /></span>
                    </div>
                    <div className="design-info">
                      <div><p className="design-category">{design.category}</p><h3>{design.name}</h3><p className="design-short">{design.short}</p></div>
                      <span className="circle-arrow"><Icon name="arrow-up" size={20} /></span>
                    </div>
                    <p className="design-price">{formatPriceRange(design.priceMinRon, design.priceMaxRon)}</p>
                  </button>
                </article>
              ))}
            </div>
          )}
          {catalogStatus === 'ready' && visibleDesigns.length > 0 && (
            <p className="concept-note"><Icon name="spark" size={15} /> {copy.collection.note}</p>
          )}
        </section>

        <section id="personalize" className="personalize-section" aria-labelledby="personalize-title">
          <div className="container personalize-inner">
            <div className="personalize-art">
              <div className="swatch-card">
                <span>{copy.personalize.artLabel}</span>
                <div
                  className="yarn-swatches"
                  role="group"
                  aria-label="Alege o temă de culoare"
                  onMouseLeave={() => setHoveredTheme(null)}
                  onBlurCapture={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                      setFocusedTheme(null)
                    }
                  }}
                >
                  {colorThemes.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      className={`yarn-swatch swatch-${theme.id}`}
                      aria-label={`Tema ${theme.label}`}
                      aria-pressed={selectedTheme === theme.id}
                      onMouseEnter={() => {
                        setFocusedTheme(null)
                        setHoveredTheme(theme.id)
                      }}
                      onFocus={() => setFocusedTheme(theme.id)}
                      onClick={() => selectTheme(theme.id)}
                    />
                  ))}
                </div>
                <p>{copy.personalize.artFirst}<br /><em>{copy.personalize.artSecond}</em></p>
                <Doodle kind="squiggle" />
              </div>
              <div className="name-tag">{copy.personalize.nameTag}<br /><span>{copy.personalize.nameTagRecipient}</span><Icon name="heart" size={22} /></div>
              <Doodle kind="flower" className="personalize-flower" />
              <span className="art-note">{copy.personalize.note}</span>
              {themeSaveError && (
                <span className="theme-save-error" role="status">
                  Tema s-a schimbat, dar nu a putut fi salvată în browser.
                </span>
              )}
            </div>
            <div className="personalize-copy">
              <p className="eyebrow">{copy.personalize.eyebrow}</p>
              <h2 id="personalize-title">{copy.personalize.titleFirst}<br /><em>{copy.personalize.titleSecond}</em></h2>
              <p>{copy.personalize.description}</p>
              <div className="touches-list">
                {copy.personalize.touches.map((touch) => <span key={touch}><Icon name="check" size={16} />{touch}</span>)}
              </div>
              <button className="text-link" onClick={() => openContact()}>{copy.personalize.action} <Icon name="arrow" size={18} /></button>
              <p className="small-note">{copy.personalize.disclaimer}</p>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="section how-section container" aria-labelledby="how-title">
          <div className="section-heading">
            <p className="eyebrow">{copy.steps.eyebrow}</p>
            <h2 id="how-title">{copy.steps.titleFirst} <em>{copy.steps.titleSecond}</em></h2>
            <p>{copy.steps.intro}</p>
          </div>
          <div className="steps">
            {copy.steps.items.map((step, index) => (
              <article key={step.title}>
                <span className={`step-number ${['peach', 'lavender', 'sage'][index]}`}>0{index + 1}<Icon name={stepIcons[index]} /></span>
                <h3>{step.title}</h3><p>{step.description}</p>
                {index < copy.steps.items.length - 1 && (
                  <svg className={`step-connector step-connector-${index + 1}`} viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                    <path className="step-connector-track" d="M1 2 C25 24 75 24 99 2" />
                  </svg>
                )}
              </article>
            ))}
          </div>
        </section>

        <section id="story" className="story-section container" aria-labelledby="story-title">
          <div className="story-image-wrap">
            <div className="story-tape" aria-hidden="true" />
            <div className="story-image-placeholder" role="img" aria-label={copy.story.imagePlaceholder}>
              <span>{copy.story.imagePlaceholder}</span>
            </div>
            <Doodle kind="spark" className="story-spark" />
          </div>
          <div className="story-copy">
            <p className="eyebrow">{copy.story.eyebrow}</p>
            <h2 id="story-title">{copy.story.titleFirst}<br /><em>{copy.story.titleSecond}</em></h2>
            <p>{copy.story.paragraphs[0]}</p>
            <p>{copy.story.paragraphs[1]}</p>
            <span className="story-signature">{copy.story.signature} <Icon name="heart" size={20} /></span>
          </div>
        </section>

        <section className="contact-section" aria-labelledby="contact-title">
          <div className="container contact-inner">
            <Doodle kind="flower" className="contact-flower" />
            <p className="eyebrow">{copy.contact.eyebrow}</p>
            <h2 id="contact-title">{copy.contact.titleFirst}<br /><em>{copy.contact.titleSecond}</em></h2>
            <p>{copy.contact.description}</p>
            <div className="contact-buttons">
              {profileLink('instagram')}
              {profileLink('tiktok')}
            </div>
            <p className="contact-disclaimer"><span className="little-dot" /> {copy.contact.demoDisclaimer}</p>
            <Doodle kind="squiggle" className="contact-squiggle" />
          </div>
        </section>
      </main>

      <footer className="footer container">
        <a className="footer-brand" href="#">snuggle stitches<span>.</span></a>
        <p>{copy.footer.tagline}</p>
        <div><span>{copy.footer.concept} &copy; {conceptYear}</span></div>
      </footer>

      {modal && (
        <Dialog title={modalTitle} closeLabel={copy.closeDialog} onDismiss={() => setModal(null)} className={modal.view === 'design' ? 'product-dialog' : ''}>
          {modal.view === 'design' && selectedDesign ? (
            <div className="product-detail">
              <div className={`detail-image ${selectedDesign.tone}`}><img src={selectedDesign.imageUrl} alt={selectedDesign.alt} /></div>
              <div className="detail-copy">
                <p className="eyebrow">{selectedDesign.category} / {selectedDesign.tag}</p>
                <h2 id="dialog-title" tabIndex={-1}>{selectedDesign.name}</h2>
                <p>{selectedDesign.description}</p>
                <div className="detail-pricing"><strong>{formatPriceRange(selectedDesign.priceMinRon, selectedDesign.priceMaxRon)}</strong><span>{copy.details.priceDepending}</span></div>
                <h3>{copy.details.title}</h3>
                <ul className="detail-touches">{copy.personalize.touches.map((touch) => <li key={touch}><Icon name="check" size={14} />{touch}</li>)}</ul>
                <button className="button" onClick={() => openContact(modal.design)}>{copy.details.contactAction} <Icon name="arrow" size={18} /></button>
                <p className="small-note">{copy.details.note}</p>
                {renderPhotoCredit(selectedDesign)}
              </div>
            </div>
          ) : modal.view === 'contact' ? (
            <div className="contact-detail">
              <span className="dialog-doodle"><Icon name="chat" size={28} /></span>
              <p className="eyebrow">{copy.contact.modalEyebrow}</p>
              <h2 id="dialog-title" tabIndex={-1}>{copy.contact.modalTitle}</h2>
              <p>{copy.contact.modalDescription}</p>
              <div className="message-preview"><span>{copy.contact.messageLabel}</span><p>{selectedDesign ? `${copy.contact.messagePrefix} ${selectedDesign.name} ${copy.contact.messageSuffix}` : copy.contact.genericMessage}</p></div>
              <p className="profile-prompt">{copy.contact.profilePrompt}</p>
              <div className="contact-channel-buttons">
                {profileLink('instagram')}
                {profileLink('tiktok')}
              </div>
              {selectedDesign && contactDesign && <button className="text-link back-link" onClick={() => setModal({ view: 'design', design: contactDesign })}><Icon name="arrow-left" size={16} />{copy.contact.returnTo} {selectedDesign.name}</button>}
            </div>
          ) : null}
        </Dialog>
      )}
    </>
  )
}

export default App
