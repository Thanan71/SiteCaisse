// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Navbar from '../../../../src/components/Navbar.vue'

const authStoreMock = vi.hoisted(() => ({
  isAdmin: true,
  isDev: false,
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
  authStoreMock.isDev = false
  authStoreMock.isAuthenticated = true
  authStoreMock.isPermanent = false
  authStoreMock.logout.mockClear()
  authStoreMock.userName = 'Admin'
  routerMock.push.mockClear()
})

function mountNavbar() {
  return mount(Navbar, {
    global: {
      mocks: { $route: { path: '/admin' } },
      stubs: {
        RouterLink: {
          emits: ['click'],
          props: ['to'],
          template: `<a :href="to" @click="$emit('click', $event)"><slot /></a>`,
        },
      },
    },
  })
}

describe('Navbar', () => {
  it.each([
    false,
    true,
  ])('reserve le lien Dev au role dev (%s), sur ordinateur et mobile', async (isDev) => {
    authStoreMock.isDev = isDev
    const wrapper = mountNavbar()
    expect(wrapper.find('a[href="/dev/suggestions"]').exists()).toBe(isDev)
    expect(wrapper.find('a[href="/suggestions"]').exists()).toBe(true)
    await wrapper.find('.navbar-toggle').trigger('click')
    expect(wrapper.findAll('a[href="/dev/suggestions"]')).toHaveLength(isDev ? 2 : 0)
    expect(wrapper.findAll('a[href="/suggestions"]')).toHaveLength(2)
  })

  it('ne montre ni administration ni Dev aux artisans', () => {
    authStoreMock.isAdmin = false
    const wrapper = mountNavbar()
    expect(wrapper.find('a[href="/admin"]').exists()).toBe(false)
    expect(wrapper.find('a[href="/dev/suggestions"]').exists()).toBe(false)
    expect(wrapper.find('a[href="/suggestions"]').exists()).toBe(true)
  })

  it('affiche la navigation connectee et deconnecte utilisateur', async () => {
    const wrapper = mountNavbar()

    expect(wrapper.text()).toContain('Site Caisse')
    expect(wrapper.text()).toContain('Admin')
    expect(wrapper.findAll('.navbar-link').map((link) => link.text())).toEqual([
      'Ventes',
      'Rapports',
      'Admin',
      'Suggestions',
    ])

    await wrapper.find('.navbar-user .btn-logout').trigger('click')
    expect(authStoreMock.logout).toHaveBeenCalledTimes(1)
    expect(routerMock.push).toHaveBeenCalledWith('/login')
  })

  it('ouvre et ferme le menu burger pour la navigation mobile', async () => {
    const wrapper = mountNavbar()
    const toggle = wrapper.find('.navbar-toggle')

    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(toggle.attributes('aria-label')).toBe('Ouvrir le menu de navigation')
    expect(wrapper.find('.navbar-mobile-menu').exists()).toBe(false)

    await toggle.trigger('click')

    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(toggle.attributes('aria-label')).toBe('Fermer le menu de navigation')
    expect(wrapper.find('.navbar-mobile-menu').exists()).toBe(true)
    expect(wrapper.findAll('.navbar-mobile-link').map((link) => link.text())).toEqual([
      'Ventes',
      'Rapports',
      'Admin',
      'Suggestions',
    ])

    await wrapper.find('.navbar-mobile-link').trigger('click')
    expect(wrapper.find('.navbar-mobile-menu').exists()).toBe(false)
    expect(toggle.attributes('aria-expanded')).toBe('false')
  })
})
