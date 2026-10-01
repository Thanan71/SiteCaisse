// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
  window.history.pushState({}, '', '/')
  window.localStorage.clear()
})

async function loadRouter(storage = {}) {
  for (const [key, value] of Object.entries(storage)) {
    window.localStorage.setItem(key, value)
  }

  const { default: router } = await import('../../../../src/router')
  return router
}

async function navigate(path, storage) {
  const router = await loadRouter(storage)

  await router.push(path)
  await router.isReady()

  return router.currentRoute.value
}

describe('router', () => {
  it.each([
    'admin',
    'dev',
    'permanent',
    'temporaire',
  ])('autorise les suggestions au role %s', async (role) => {
    const route = await navigate('/suggestions', { token: 'token', user: JSON.stringify({ role }) })
    expect(route.name).toBe('Suggestions')
  })

  it.each([
    'admin',
    'dev',
    'permanent',
    'temporaire',
  ])('protege la liste dev pour le role %s', async (role) => {
    const route = await navigate('/dev/suggestions', {
      token: 'token',
      user: JSON.stringify({ role }),
    })
    expect(route.name).toBe(role === 'dev' ? 'DevSuggestions' : 'Ventes')
  })

  it('autorise dev a administrer et protege les suggestions sans connexion', async () => {
    expect(
      (await navigate('/admin', { token: 'token', user: JSON.stringify({ role: 'dev' }) })).name,
    ).toBe('Admin')
    window.localStorage.clear()
    expect((await navigate('/suggestions')).name).toBe('Login')
    expect((await navigate('/dev/suggestions')).name).toBe('Login')
  })

  it('declare les routes publiques, protegees et admin', async () => {
    const router = await loadRouter()
    const routes = router.getRoutes()

    expect(routes.map((route) => route.name)).toEqual(
      expect.arrayContaining(['Login', 'ChangePassword', 'Ventes', 'Rapports', 'Admin']),
    )
    expect(routes.find((route) => route.name === 'Login').meta.requiresAuth).toBe(false)
    expect(routes.find((route) => route.name === 'Admin').meta.requiresAdmin).toBe(true)
  })

  it('redirige une route protegee vers login sans token', async () => {
    const route = await navigate('/rapports')

    expect(route.name).toBe('Login')
  })

  it('redirige login vers ventes quand un token existe', async () => {
    const route = await navigate('/login', { token: 'token-123' })

    expect(route.name).toBe('Ventes')
  })

  it('reserve admin aux utilisateurs admin', async () => {
    const nonAdminRoute = await navigate('/admin', {
      token: 'token-123',
      user: JSON.stringify({ role: 'permanent' }),
    })

    expect(nonAdminRoute.name).toBe('Ventes')

    const invalidUserRoute = await navigate('/admin', {
      token: 'token-123',
      user: '{role',
    })

    expect(invalidUserRoute.name).toBe('Ventes')

    const adminRoute = await navigate('/admin', {
      token: 'token-123',
      user: JSON.stringify({ role: 'admin' }),
    })

    expect(adminRoute.name).toBe('Admin')
  })
})
