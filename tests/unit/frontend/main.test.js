// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mainMocks = vi.hoisted(() => {
  const app = {
    use: vi.fn(function use() {
      return this
    }),
    mount: vi.fn(),
  }

  return {
    app,
    appComponent: { name: 'AppRoot' },
    createApp: vi.fn(() => app),
    createPinia: vi.fn(() => ({ install: vi.fn(), name: 'pinia' })),
    router: { install: vi.fn(), name: 'router' },
  }
})

vi.mock('vue', () => ({
  createApp: mainMocks.createApp,
}))

vi.mock('pinia', () => ({
  createPinia: mainMocks.createPinia,
}))

vi.mock('../../../src/App.vue', () => ({
  default: mainMocks.appComponent,
}))

vi.mock('../../../src/router', () => ({
  default: mainMocks.router,
}))

vi.mock('../../../src/services/api', () => ({}))

beforeEach(() => {
  vi.resetModules()
  mainMocks.app.use.mockClear()
  mainMocks.app.mount.mockClear()
  mainMocks.createApp.mockClear()
  mainMocks.createPinia.mockClear()
})

describe('main', () => {
  it('monte l application Vue avec Pinia et le router', async () => {
    await import('../../../src/main.js')

    const pinia = mainMocks.createPinia.mock.results[0].value

    expect(mainMocks.createApp).toHaveBeenCalledWith(mainMocks.appComponent)
    expect(mainMocks.createPinia).toHaveBeenCalledTimes(1)
    expect(mainMocks.app.use).toHaveBeenNthCalledWith(1, pinia)
    expect(mainMocks.app.use).toHaveBeenNthCalledWith(2, mainMocks.router)
    expect(mainMocks.app.mount).toHaveBeenCalledWith('#app')
  })
})
