import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { Dialog } from '../components/Dialog'
import { Icon } from '../components/Graphics'
import { ProductGallery } from '../components/ProductGallery'
import { productImages, type ProductInput, type ProductRow } from '../worker/products'

type ProductResponse = {
  products?: ProductRow[]
  product?: ProductRow
  error?: string
  warning?: string
}

type AdminStatus = {
  loading: boolean
  saving: boolean
  message: string
  error: boolean
}

type GalleryPhoto = { id: string; url: string; file?: File }

class AdminAuthenticationError extends Error {
  constructor() {
    super('Sesiunea a expirat. Introdu parola de administrator pentru a continua.')
  }
}

const blankProduct = (sortOrder = 1): ProductInput => ({
  name: '',
  tag: '',
  short: '',
  description: '',
  alt: '',
  category: 'Animăluțe',
  priceMinRon: 75,
  priceMaxRon: 200,
  imageUrl: '',
  creditAuthor: '',
  creditUrl: '',
  creditLicense: '',
  published: false,
  sortOrder,
})

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, { ...init, credentials: 'same-origin' })
  } catch (error) {
    if (error instanceof TypeError) throw new Error('Nu mă pot conecta la server. Verifică conexiunea și încearcă din nou.')
    throw error
  }
  let payload: ProductResponse
  try {
    payload = await response.json() as ProductResponse
  } catch {
    throw new Error('Răspunsul serverului nu este valid.')
  }
  if (!response.ok) {
    if (response.status === 401 && path !== '/api/admin/session') throw new AdminAuthenticationError()
    throw new Error(payload.error ?? `Cererea a eșuat (${response.status}).`)
  }
  return payload as T
}

function AdminApp() {
  const [products, setProducts] = useState<ProductRow[]>([])
  const [form, setForm] = useState<ProductInput>(() => blankProduct())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [focusTagOnOpen, setFocusTagOnOpen] = useState(false)
  const [photos, setPhotos] = useState<GalleryPhoto[]>([])
  const photosRef = useRef<GalleryPhoto[]>([])
  const [priceMode, setPriceMode] = useState<'fixed' | 'range'>('range')
  const [draggedPhoto, setDraggedPhoto] = useState<string | null>(null)
  const [filter, setFilter] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginSaving, setLoginSaving] = useState(false)
  const [needsLogin, setNeedsLogin] = useState(false)
  const tagInputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<AdminStatus>({
    loading: true,
    saving: false,
    message: '',
    error: false,
  })
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    request<ProductResponse>('/api/admin/products')
      .then((payload) => {
        if (!active) return
        setProducts(payload.products ?? [])
        setNeedsLogin(false)
        setStatus((current) => ({ ...current, loading: false }))
      })
      .catch((error: unknown) => {
        if (!active) return
        if (error instanceof AdminAuthenticationError) {
          setNeedsLogin(true)
          setProducts([])
          setStatus((current) => ({ ...current, loading: false, error: false, message: '' }))
        } else {
          setStatus((current) => ({
            ...current,
            loading: false,
            error: true,
            message: error instanceof Error ? error.message : 'Produsele nu au putut fi încărcate.',
          }))
        }
      })
    return () => { active = false }
  }, [reload])

  useEffect(() => () => {
    photosRef.current.forEach((photo) => { if (photo.file) URL.revokeObjectURL(photo.url) })
  }, [])

  function replacePhotos(next: GalleryPhoto[]) {
    photosRef.current.forEach((photo) => {
      if (photo.file && !next.some((item) => item.id === photo.id)) URL.revokeObjectURL(photo.url)
    })
    photosRef.current = next
    setPhotos(next)
  }

  function addPhotos(files: File[]) {
    const message = photos.length + files.length > 5
      ? 'Poți adăuga maximum 5 fotografii.'
      : files.some((file) => file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
        ? 'Alege fotografii JPG, PNG sau WebP, fiecare de maximum 5 MB.'
        : ''
    if (message) {
      setStatus((current) => ({ ...current, message, error: true }))
      return
    }
    replacePhotos([...photos, ...files.map((file) => ({ id: crypto.randomUUID(), url: URL.createObjectURL(file), file }))])
    setStatus((current) => ({ ...current, message: '', error: false }))
  }

  function movePhoto(source: string, target: string) {
    const next = [...photos]
    const index = next.findIndex((photo) => photo.id === source)
    const targetIndex = next.findIndex((photo) => photo.id === target)
    if (index < 0 || targetIndex < 0) return
    const [photo] = next.splice(index, 1)
    next.splice(targetIndex, 0, photo)
    replacePhotos(next)
  }

  function editProduct(product: ProductRow, focusTag = false) {
    setEditingId(product.id)
    replacePhotos(productImages(product).map((url) => ({ id: crypto.randomUUID(), url })))
    setPriceMode(product.priceMinRon === product.priceMaxRon ? 'fixed' : 'range')
    setFocusTagOnOpen(focusTag)
    setForm({
      name: product.name,
      tag: product.tag,
      short: product.short,
      description: product.description,
      alt: product.alt,
      category: product.category,
      priceMinRon: product.priceMinRon,
      priceMaxRon: product.priceMaxRon,
      imageUrl: product.imageUrl,
      creditAuthor: product.creditAuthor,
      creditUrl: product.creditUrl,
      creditLicense: product.creditLicense,
      published: product.published,
      sortOrder: product.sortOrder,
    })
    setStatus((current) => ({ ...current, error: false, message: '' }))
    setEditorOpen(true)
  }

  function startNewProduct() {
    setEditingId(null)
    replacePhotos([])
    setPriceMode('range')
    setForm(blankProduct(products.reduce((max, product) => Math.max(max, product.sortOrder), 0) + 1))
    setFocusTagOnOpen(false)
    setStatus((current) => ({ ...current, error: false, message: '' }))
    setEditorOpen(true)
  }

  function closeEditor() {
    setEditorOpen(false)
    setEditingId(null)
    replacePhotos([])
    setForm(blankProduct(products.length + 1))
    setFocusTagOnOpen(false)
  }

  function setTextField(field: keyof ProductInput, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!photos.length) {
      setStatus((current) => ({ ...current, message: 'Adaugă cel puțin o fotografie.', error: true }))
      return
    }
    setStatus((current) => ({ ...current, saving: true, message: '', error: false }))
    const body = new FormData()
    body.set('product', JSON.stringify({
      ...form,
      imageUrl: photos[0]?.file ? '' : photos[0]?.url ?? '',
      priceMaxRon: priceMode === 'fixed' ? form.priceMinRon : form.priceMaxRon,
    }))
    let uploadIndex = 0
    body.set('gallery', JSON.stringify(photos.map((photo) => {
      if (!photo.file) return photo.url
      body.append('images', photo.file)
      return `upload:${uploadIndex++}`
    })))
    try {
      const path = editingId ? `/api/admin/products/${editingId}` : '/api/admin/products'
      const payload = await request<ProductResponse>(path, { method: editingId ? 'PUT' : 'POST', body })
      closeEditor()
      setStatus((current) => ({
        ...current,
        saving: false,
        error: false,
        message: payload.warning ?? 'Model salvat.',
      }))
      setReload((value) => value + 1)
    } catch (error) {
      if (error instanceof AdminAuthenticationError) {
        setNeedsLogin(true)
        setProducts([])
        setStatus((current) => ({ ...current, saving: false, error: false, message: '' }))
      } else {
        setStatus((current) => ({
          ...current,
          saving: false,
          error: true,
          message: error instanceof Error ? error.message : 'Modelul nu a putut fi salvat.',
        }))
      }
    }
  }

  async function deleteProduct(product: ProductRow) {
    if (!window.confirm(`Ștergi modelul „${product.name}”? Acțiunea nu poate fi anulată.`)) return
    setStatus((current) => ({ ...current, message: '', error: false }))
    try {
      const payload = await request<ProductResponse>(`/api/admin/products/${product.id}`, { method: 'DELETE' })
      if (editingId === product.id) closeEditor()
      setStatus((current) => ({
        ...current,
        message: payload.warning ?? 'Model șters.',
        error: false,
      }))
      setReload((value) => value + 1)
    } catch (error) {
      if (error instanceof AdminAuthenticationError) {
        setNeedsLogin(true)
        setProducts([])
      } else {
        setStatus((current) => ({
          ...current,
          error: true,
          message: error instanceof Error ? error.message : 'Modelul nu a putut fi șters.',
        }))
      }

    }
  }

  function beginProductDrag(productId: string, event: DragEvent<HTMLButtonElement>) {
    if (reordering) {
      event.preventDefault()
      return
    }
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', productId)
    setDraggingId(productId)
  }

  async function reorderProducts(sourceId: string, targetId: string) {
    if (reordering || sourceId === targetId) return
    const sourceIndex = products.findIndex((product) => product.id === sourceId)
    const targetIndex = products.findIndex((product) => product.id === targetId)
    if (sourceIndex < 0 || targetIndex < 0) return

    const previousProducts = products
    const nextProducts = [...products]
    const [movedProduct] = nextProducts.splice(sourceIndex, 1)
    nextProducts.splice(targetIndex, 0, movedProduct)
    setProducts(nextProducts)
    setReordering(true)
    setStatus((current) => ({ ...current, error: false, message: '' }))
    try {
      const payload = await request<ProductResponse>('/api/admin/products/reorder', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productIds: nextProducts.map((product) => product.id) }),
      })
      if (!payload.products) throw new Error('Ordinea produselor nu a fost confirmată de server.')
      setProducts(payload.products)
      setStatus((current) => ({ ...current, error: false, message: payload.warning ?? 'Ordinea colecției a fost salvată.' }))
    } catch (error) {
      if (error instanceof AdminAuthenticationError) {
        setNeedsLogin(true)
        setProducts([])
        setStatus((current) => ({ ...current, error: false, message: '' }))
      } else {
        setProducts(previousProducts)
        setStatus((current) => ({
          ...current,
          error: true,
          message: error instanceof Error ? error.message : 'Ordinea colecției nu a putut fi salvată.',
        }))
      }
    } finally {
      setReordering(false)
      setDraggingId(null)
    }
  }

  function dropProduct(targetId: string, event: DragEvent<HTMLElement>) {
    event.preventDefault()
    const sourceId = event.dataTransfer.getData('text/plain') || draggingId
    if (sourceId) void reorderProducts(sourceId, targetId)
  }

  function moveProduct(productId: string, offset: -1 | 1) {
    const index = products.findIndex((product) => product.id === productId)
    const target = products[index + offset]
    if (target) void reorderProducts(productId, target.id)
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoginSaving(true)
    setLoginError('')
    try {
      await request('/api/admin/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: loginPassword }),
      })
      setLoginPassword('')
      setNeedsLogin(false)
      setReload((value) => value + 1)
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Autentificarea nu a reușit.')
    } finally {
      setLoginSaving(false)
    }
  }

  async function logout() {
    try {
      await request('/api/admin/session', { method: 'DELETE' })
      setProducts([])
      setNeedsLogin(true)
      setLoginError('')
      setStatus((current) => ({ ...current, message: '', error: false }))
    } catch (error) {
      setStatus((current) => ({
        ...current,
        error: true,
        message: error instanceof Error ? error.message : 'Deconectarea nu a reușit.',
      }))
    }
  }

  const categories = [...new Set(products.map((product) => product.category))]
  const displayedProducts = products
    .map((product, index) => ({ product, tone: ['peach', 'sage', 'lavender', 'butter', 'blue'][index % 5] }))
    .filter(({ product }) => filter === null || product.category === filter)

  if (needsLogin) {
    return (
      <main className="admin-shell">
        <header className="admin-header">
          <a className="admin-brand" href="/">snuggle stitches<span>.</span></a>
          <a className="admin-back" href="/">Vezi pagina magazinului ↗</a>
        </header>
        <section className="admin-intro">
          <p className="eyebrow">ZONĂ PRIVATĂ</p>
          <h1>Administrare <em>Snuggle Stitches.</em></h1>
          <p>Introdu parola de administrator pentru a gestiona produsele.</p>
          <form className="admin-login" onSubmit={(event) => void login(event)}>
            <label>
              Parolă admin
              <input
                type="password"
                autoComplete="current-password"
                required
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
              />
            </label>
            {loginError && <p className="admin-status is-error" role="alert">{loginError}</p>}
            <button type="submit" className="admin-button" disabled={loginSaving}>
              {loginSaving ? 'Se verifică...' : 'Autentificare'}
            </button>
          </form>
        </section>
      </main>
    )
  }

  return (
    <main className="admin-collection-page">
      <header className="admin-header site-header admin-collection-header">
        <div className="header-inner container">
          <a className="admin-brand" href="/">snuggle stitches<span>.</span></a>
          <div className="admin-header-actions">
            <a className="admin-back" href="/">Vezi pagina completă ↗</a>
            {!status.loading && <button type="button" className="admin-cancel" onClick={() => void logout()}>Deconectare</button>}
          </div>
        </div>
      </header>

      <section className="collection section container admin-collection" aria-labelledby="admin-collection-title">
        <div className="section-heading">
          <p className="eyebrow">ATELIERUL TĂU DIGITAL</p>
          <h2 id="admin-collection-title">Noul tău <em>prieten drag.</em></h2>
          <p>Editează colecția exact așa cum o văd vizitatorii.</p>
        </div>
        {status.message && !editorOpen && (
          <p className={status.error ? 'admin-status is-error' : 'admin-status'} role={status.error ? 'alert' : 'status'}>
            {status.message}
          </p>
        )}

        <div className="collection-toolbar admin-collection-toolbar">
          <div className="filters" role="group" aria-label="Filtrează colecția">
            <button type="button" className={filter === null ? 'filter is-active' : 'filter'} aria-pressed={filter === null} onClick={() => setFilter(null)}>
              <Icon name="spark" size={15} />Toate
            </button>
            {categories.map((category) => (
              <button key={category} type="button" className={filter === category ? 'filter is-active' : 'filter'} aria-pressed={filter === category} onClick={() => setFilter(category)}>
                {category}
              </button>
            ))}
          </div>
          <div className="admin-collection-actions">
            {!status.loading && (
              <p className="collection-price">
                {displayedProducts.length} {displayedProducts.length === 1 ? 'model' : 'modele'}
                {' · '}{displayedProducts.filter(({ product }) => product.published).length} publicate
              </p>
            )}
            <button type="button" className="button button-small" onClick={startNewProduct}>
              <Icon name="plus" size={17} />Adaugă un model
            </button>
          </div>
        </div>

        <div className="admin-collection-hint">
          <p>Deschide un card pentru a-i edita detaliile.</p>
          <p>Apasă pe etichetă pentru editare rapidă.</p>
          <p>Trage cardurile sau folosește săgețile pentru reordonare.</p>
        </div>

        {status.loading ? (
          <p className="catalog-message" role="status">Se încarcă produsele...</p>
        ) : products.length === 0 ? (
          <div className="catalog-message catalog-empty">
            <h3>Colecția ta începe aici.</h3>
            <p>Adaugă primul model și încarcă-i fotografia.</p>
          </div>
        ) : displayedProducts.length === 0 ? (
          <p className="catalog-message">Nu există modele în această categorie.</p>
        ) : (
          <div className="design-grid admin-design-grid">
            {displayedProducts.map(({ product, tone }) => (
              <article
                key={product.id}
                className={`design-card ${tone}${draggingId === product.id ? ' is-dragging' : ''}`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => dropProduct(product.id, event)}
              >
                <div className="design-image admin-design-image">
                  <button type="button" className="admin-card-open" aria-label={`Editează ${product.name}`} onClick={() => editProduct(product)}>
                    {product.imageUrl ? (
                      <ProductGallery images={productImages(product)} alt={product.alt} />
                    ) : (
                      <span className="admin-image-placeholder"><Icon name="gift" size={38} />Adaugă fotografia modelului</span>
                    )}
                    <span className="design-image-action">Editează detaliile <Icon name="plus" size={16} /></span>
                  </button>
                  <button type="button" className="design-tag admin-tag-edit" onClick={() => editProduct(product, true)} aria-label={`Editează eticheta: ${product.tag}`}>
                    {product.tag || 'Adaugă etichetă'}
                  </button>
                  <span className={`admin-publish-badge${product.published ? ' is-published' : ''}`}>
                    {product.published ? 'Publicat' : 'Ciornă'}
                  </span>
                </div>
                <button type="button" className="admin-card-details" onClick={() => editProduct(product)} aria-label={`Editează detaliile pentru ${product.name}`}>
                  <div className="design-info">
                    <div>
                      <p className="design-category">{product.category}</p>
                      <h3>{product.name || 'Model fără nume'}</h3>
                      <p className="design-short">{product.short}</p>
                    </div>
                    <span className="circle-arrow"><Icon name="arrow-up" size={20} /></span>
                  </div>
                  <p className="design-price">{product.priceMinRon === product.priceMaxRon ? `${product.priceMinRon} RON` : `${product.priceMinRon}–${product.priceMaxRon} RON`}</p>
                </button>
                <div className="admin-card-reorder" role="group" aria-label={`Reordonează ${product.name}`}>
                  <button type="button" aria-label={`Mută ${product.name} mai sus`} disabled={reordering || products[0]?.id === product.id} onClick={() => moveProduct(product.id, -1)}>↑</button>
                  <button type="button" aria-label={`Mută ${product.name} mai jos`} disabled={reordering || products.at(-1)?.id === product.id} onClick={() => moveProduct(product.id, 1)}>↓</button>
                  <button
                    type="button"
                    className="admin-drag-handle"
                    draggable={!reordering}
                    aria-label={`Trage pentru a reordona ${product.name}`}
                    title="Trage pentru a reordona"
                    onDragStart={(event) => beginProductDrag(product.id, event)}
                    onDragEnd={() => setDraggingId(null)}
                  >
                    ⠿ <span>Reordonează</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {editorOpen && (
        <Dialog
          title={editingId ? 'Editează modelul' : 'Adaugă un model'}
          closeLabel="Închide editorul"
          onDismiss={closeEditor}
          initialFocusRef={focusTagOnOpen ? tagInputRef : undefined}
          className="product-dialog admin-product-dialog"
        >
          <form className="admin-item-editor" onSubmit={(event) => void saveProduct(event)}>
            <div className={`admin-item-photo ${['peach', 'sage', 'lavender', 'butter', 'blue'][Math.max(0, products.findIndex((product) => product.id === editingId)) % 5]}`}>
              {photos.length > 0 ? (
                <ProductGallery key={editingId ?? 'new'} images={photos.map((photo) => photo.url)} alt={form.alt || 'Previzualizare fotografie produs'} carousel />
              ) : (
                <div className="admin-image-placeholder"><Icon name="gift" size={46} />Fotografia modelului</div>
              )}
              <label className="admin-image-upload">
                <span>Adaugă fotografii ({photos.length}/5)</span>
                <input
                  aria-label="Imagine produs"
                  type="file"
                  multiple
                  disabled={photos.length >= 5 || status.saving}
                  accept="image/jpeg,image/png,image/webp"
                  required={photos.length === 0}
                  onChange={(event) => {
                    addPhotos(Array.from(event.target.files ?? []))
                    event.target.value = ''
                  }}
                />
              </label>
              <small>Maximum 5 fotografii · JPG, PNG sau WebP · maximum 5 MB fiecare. Prima este coperta.</small>
              <ol className="admin-photo-list" aria-label="Ordinea fotografiilor">
                {photos.map((photo, index) => (
                  <li key={photo.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
                    event.preventDefault()
                    const source = draggedPhoto ?? event.dataTransfer.getData('text/plain')
                    if (source) movePhoto(source, photo.id)
                    setDraggedPhoto(null)
                  }}>
                    <img src={photo.url} alt="" />
                    <span>{index === 0 ? 'Copertă' : `Fotografia ${index + 1}`}</span>
                    <button type="button" aria-label={`Mută fotografia ${index + 1} mai sus`} disabled={index === 0 || status.saving} onClick={() => movePhoto(photo.id, photos[index - 1].id)}>↑</button>
                    <button type="button" aria-label={`Mută fotografia ${index + 1} mai jos`} disabled={index === photos.length - 1 || status.saving} onClick={() => movePhoto(photo.id, photos[index + 1].id)}>↓</button>
                    <button type="button" draggable={!status.saving} aria-label={`Trage fotografia ${index + 1}`} onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'move'
                      event.dataTransfer.setData('text/plain', photo.id)
                      setDraggedPhoto(photo.id)
                    }} onDragEnd={() => setDraggedPhoto(null)}>↕</button>
                    <button type="button" disabled={status.saving} aria-label={`Șterge fotografia ${index + 1}`} onClick={() => replacePhotos(photos.filter((item) => item.id !== photo.id))}>×</button>
                  </li>
                ))}
              </ol>
            </div>

            <div className="admin-item-fields">
              <p className="eyebrow">{editingId ? 'DETALII MODEL' : 'MODEL NOU'}</p>
              <h2 id="dialog-title" tabIndex={-1}>{editingId ? 'Editează modelul' : 'Adaugă un model'}</h2>
              {status.error && status.message && <p className="admin-status is-error" role="alert">{status.message}</p>}
              <label>
                Etichetă
                <input ref={tagInputRef} required maxLength={80} value={form.tag} onChange={(event) => setTextField('tag', event.target.value)} />
              </label>
              <label>
                Nume model
                <input required maxLength={120} value={form.name} onChange={(event) => setTextField('name', event.target.value)} />
              </label>
              <label>
                Descriere scurtă
                <input required maxLength={180} value={form.short} onChange={(event) => setTextField('short', event.target.value)} />
              </label>
              <label>
                Descriere
                <textarea required maxLength={2000} rows={4} value={form.description} onChange={(event) => setTextField('description', event.target.value)} />
              </label>
              <label>
                Text alternativ pentru imagine
                <input required maxLength={250} value={form.alt} onChange={(event) => setTextField('alt', event.target.value)} />
              </label>
              <label>
                Categorie
                <input
                  aria-describedby="product-category-help"
                  aria-label="Categorie"
                  required
                  maxLength={60}
                  list="product-category-options"
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                />
                <datalist id="product-category-options">
                  {categories.map((category) => <option key={category} value={category} />)}
                </datalist>
                <small id="product-category-help">Scrie o categorie nouă sau alege una existentă.</small>
              </label>
              <label>
                Tip preț
                <select value={priceMode} onChange={(event) => setPriceMode(event.target.value === 'fixed' ? 'fixed' : 'range')}>
                  <option value="fixed">Preț fix</option>
                  <option value="range">Interval de preț</option>
                </select>
              </label>
              <div className="admin-price-fields">
                <label>
                  {priceMode === 'fixed' ? 'Preț (RON)' : 'Preț minim (RON)'}
                  <input type="number" min="0" step="1" required value={form.priceMinRon} onChange={(event) => setForm((current) => ({ ...current, priceMinRon: Number(event.target.value) }))} />
                </label>
                {priceMode === 'range' && <label>
                  Preț maxim (RON)
                  <input type="number" min="0" step="1" required value={form.priceMaxRon} onChange={(event) => setForm((current) => ({ ...current, priceMaxRon: Number(event.target.value) }))} />
                </label>}
              </div>
              <label className="admin-publish">
                <input type="checkbox" checked={form.published} onChange={(event) => setForm((current) => ({ ...current, published: event.target.checked }))} />
                Publică modelul în colecția vizitatorilor
              </label>
              <div className="admin-editor-actions">
                {editingId && (
                  <button type="button" className="admin-delete-button" onClick={() => {
                    const product = products.find((item) => item.id === editingId)
                    if (product) void deleteProduct(product)
                  }}>Șterge modelul</button>
                )}
                <button type="button" className="admin-cancel" onClick={closeEditor}>Anulează</button>
                <button className="button button-small" type="submit" disabled={status.saving}>
                  {status.saving ? 'Se salvează...' : editingId ? 'Salvează modificările' : 'Adaugă modelul'}
                </button>
              </div>
            </div>
          </form>
        </Dialog>
      )}
    </main>
  )
}

export default AdminApp
