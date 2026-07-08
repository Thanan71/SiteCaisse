import { createPinia, setActivePinia } from 'pinia'
import { vi } from 'vitest'

export function installLocalStorage(initialValues = {}) {
  const store = new Map(Object.entries(initialValues))

  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key) => (store.has(key) ? store.get(key) : null)),
    setItem: vi.fn((key, value) => store.set(key, String(value))),
    removeItem: vi.fn((key) => store.delete(key)),
    clear: vi.fn(() => store.clear()),
  })

  return store
}

export function installPiniaStoreTest() {
  vi.clearAllMocks()
  setActivePinia(createPinia())
  installLocalStorage()
}
