// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Navbar from '../../../../src/components/Navbar.vue'

const authStoreMock = vi.hoisted(() => ({
  isAdmin: true,
  isAuthenticated: true,
  isPermanent: false,
  logout: vi.fn(),
  userName: 'Admin',
}))

const routerMock = vi.hoisted(() => ({
  push: vi.fn(),
}))

vi.mock('../../../../src/store/auth', () => ({
  useAuthStore: () => authStoreMock,
}))

vi.mock('vue-router', () => ({
  useRouter: () => routerMock,
}))

beforeEach(() => {
  authStoreMock.isAdmin = true
  authStoreMock.isAuthenticated = true
  authStoreMock.isPermanent = false
  authStoreMock.logout.mockClear()
  authStoreMock.userName = 'Admin'
  routerMock.push.mockClear()
})

describe('Navbar', () => {
  it('affiche la navigation connectee et deconnecte utilisateur', async () => {
    const wrapper = mount(Navbar, {
      global: {
        mocks: { $route: { path: '/admin' } },
        stubs: {
          RouterLink: { props: ['to'], template: '<a><slot /></a>' },
        },
      },
    })

    expect(wrapper.text()).toContain('Site Caisse')
    expect(wrapper.text()).toContain('Admin')
    expect(wrapper.findAll('.navbar-link').map((link) => link.text())).toEqual([
      'Ventes',
      'Rapports',
      'Admin',
    ])

    await wrapper.find('.btn-logout').trigger('click')
    expect(authStoreMock.logout).toHaveBeenCalledTimes(1)
    expect(routerMock.push).toHaveBeenCalledWith('/login')
  })
})
