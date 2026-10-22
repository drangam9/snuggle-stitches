import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { Icon } from './Graphics'

export function Dialog({ title, closeLabel, onDismiss, className = '', initialFocusRef, children }: {
  title: string
  closeLabel: string
  onDismiss: () => void
  className?: string
  initialFocusRef?: RefObject<HTMLElement | null>
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const previousOverflow = document.body.style.overflow
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    if (initialFocusRef?.current) initialFocusRef.current.focus()
    else ref.current?.querySelector<HTMLElement>('h2')?.focus()
    if (ref.current) ref.current.scrollTop = 0
  }, [initialFocusRef, title])

  return (
    <dialog
      ref={ref}
      className={`dialog ${className}`}
      aria-labelledby="dialog-title"
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]'))
          .filter((element) => element.getClientRects().length > 0)
        const first = controls[0]
        const last = controls.at(-1)
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }}
      onCancel={(event) => { event.preventDefault(); onDismiss() }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return
        const bounds = event.currentTarget.getBoundingClientRect()
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onDismiss()
      }}
    >
      <button className="dialog-close icon-button" aria-label={closeLabel} onClick={onDismiss}><Icon name="close" size={20} /></button>
      {children}
    </dialog>
  )
}
