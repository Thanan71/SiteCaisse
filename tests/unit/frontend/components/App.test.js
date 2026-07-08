// @vitest-environment happy-dom

import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../../../src/App.vue'

const authStoreMock = vi.hoisted(() => ({
  fetchUser: vi.fn(async () => ({ id: 1 })),
  isAuthenticated: true,
  token: '',
}))

vi.mock('../../../../src/store/auth', () => ({
  useAuthStore: () => authStoreMock,
}))

vi.mock('@vercel/speed-insights/vue', () => ({
  SpeedInsights: {
    name: 'SpeedInsights',
    template: '<span class="speed-insights-stub"></span>',
  },
}))

beforeEach(() => {
  authStoreMock.fetchUser.mockClear()
  authStoreMock.fetchUser.mockResolvedValue({ id: 1 })
  authStoreMock.isAuthenticated = true
  authStoreMock.token = ''
})

describe('App', () => {
  it('verifie la session au montage de l application si un token existe', async () => {
    authStoreMock.token = 'token-123'

    const wrapper = mount(App, {
      global: {
        stubs: {
          Navbar: true,
          RouterView: { template: '<section class="router-view-stub"></section>' },
        },
      },
    })
    await flushPromises()

    expect(authStoreMock.fetchUser).toHaveBeenCalledTimes(1)
    expect(wrapper.find('main').classes()).toContain('with-navbar')
  })
})
