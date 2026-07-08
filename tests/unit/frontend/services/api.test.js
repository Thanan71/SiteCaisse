// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const axiosMocks = vi.hoisted(() => {
  const handlers = {
    requestFulfilled: null,
    responseFulfilled: null,
    responseRejected: null,
  }

  const instance = {
    interceptors: {
      request: {
        use: vi.fn((fulfilled) => {
          handlers.requestFulfilled = fulfilled
        }),
      },
      response: {
        use: vi.fn((fulfilled, rejected) => {
          handlers.responseFulfilled = fulfilled
          handlers.responseRejected = rejected
        }),
      },
    },
  }

  return {
    create: vi.fn(() => instance),
    handlers,
    instance,
  }
})

vi.mock('axios', () => ({
  default: {
    create: axiosMocks.create,
  },
}))

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_API_URL', '/api')
  localStorage.clear()
  window.history.replaceState({}, '', '/')

  axiosMocks.create.mockClear()
  axiosMocks.instance.interceptors.request.use.mockClear()
  axiosMocks.instance.interceptors.response.use.mockClear()
  axiosMocks.handlers.requestFulfilled = null
  axiosMocks.handlers.responseFulfilled = null
  axiosMocks.handlers.responseRejected = null
})

afterEach(() => {
  vi.unstubAllEnvs()
})

async function loadApi() {
  const module = await import('../../../../src/services/api')
  return module.default
}

describe('api service', () => {
  it('cree une instance Axios avec les intercepteurs attendus', async () => {
    const api = await loadApi()

    expect(api).toBe(axiosMocks.instance)
    expect(axiosMocks.create).toHaveBeenCalledWith({ baseURL: '/api' })
    expect(axiosMocks.instance.interceptors.request.use).toHaveBeenCalledTimes(1)
    expect(axiosMocks.instance.interceptors.response.use).toHaveBeenCalledTimes(1)
  })

  it('ajoute le token bearer aux requetes quand il existe', async () => {
    await loadApi()
    localStorage.setItem('token', 'token-123')

    const config = axiosMocks.handlers.requestFulfilled({ headers: {} })

    expect(config.headers.Authorization).toBe('Bearer token-123')
  })

  it('laisse les requetes sans Authorization quand aucun token n existe', async () => {
    await loadApi()

    const config = axiosMocks.handlers.requestFulfilled({ headers: {} })

    expect(config.headers.Authorization).toBeUndefined()
  })

  it('renvoie les reponses et nettoie la session sur une erreur 401 hors login', async () => {
    await loadApi()
    const response = { data: { ok: true } }
    localStorage.setItem('token', 'token-123')
    localStorage.setItem('user', JSON.stringify({ id: 1 }))
    window.history.replaceState({}, '', '/ventes')

    expect(axiosMocks.handlers.responseFulfilled(response)).toBe(response)
    await expect(
      axiosMocks.handlers.responseRejected({ response: { status: 401 } }),
    ).rejects.toMatchObject({ response: { status: 401 } })

    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
    expect(window.location.pathname).toBe('/login')
  })

  it('ne redirige pas une erreur 401 deja recue sur la page login', async () => {
    await loadApi()
    localStorage.setItem('token', 'token-123')
    localStorage.setItem('user', JSON.stringify({ id: 1 }))
    window.history.replaceState({}, '', '/login')

    await expect(
      axiosMocks.handlers.responseRejected({ response: { status: 401 } }),
    ).rejects.toMatchObject({ response: { status: 401 } })

    expect(localStorage.getItem('token')).toBe('token-123')
    expect(localStorage.getItem('user')).toBe(JSON.stringify({ id: 1 }))
    expect(window.location.pathname).toBe('/login')
  })

  it('propage les erreurs non authentification sans nettoyer la session', async () => {
    await loadApi()
    localStorage.setItem('token', 'token-123')

    await expect(
      axiosMocks.handlers.responseRejected({ response: { status: 500 } }),
    ).rejects.toMatchObject({ response: { status: 500 } })

    expect(localStorage.getItem('token')).toBe('token-123')
  })
})
