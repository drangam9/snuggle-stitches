import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(cleanup)

if (!document.querySelector('meta[name="description"]')) {
  const description = document.createElement('meta')
  description.name = 'description'
  document.head.appendChild(description)
}

Object.defineProperties(HTMLDialogElement.prototype, {
  showModal: {
    value(this: HTMLDialogElement) {
      this.setAttribute('open', '')
    },
  },
  close: {
    value(this: HTMLDialogElement) {
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    },
  },
})
