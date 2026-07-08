import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../../../src/services/api'
import { installPiniaStoreTest } from './storeTestUtils'

vi.mock('../../../../src/services/api', () => ({
  default: {
    delete: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}))

beforeEach(() => {
  installPiniaStoreTest()
})

import { useAuthStore } from '../../../../src/store/auth'

describe('auth store', () => {
  it('connecte, persiste puis deconnecte un utilisateur', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        token: 'token-123',
        password_change_required: true,
        user: { id: 1, nom: 'Admin', role: 'admin' },
      },
    })

    const store = useAuthStore()
    const result = await store.login('Administration', 'password123')

    expect(api.post).toHaveBeenCalledWith('/api/auth/login', {
      nom_boutique: 'Administration',
      password: 'password123',
    })
    expect(result.password_change_required).toBe(true)
    expect(store.isAuthenticated).toBe(true)
    expect(store.isAdmin).toBe(true)
    expect(localStorage.setItem).toHaveBeenCalledWith('token', 'token-123')

    store.logout()

    expect(store.token).toBe('')
    expect(store.user).toBeNull()
    expect(localStorage.removeItem).toHaveBeenCalledWith('token')
    expect(localStorage.removeItem).toHaveBeenCalledWith('user')
  })

  it('rafraichit le profil ou deconnecte si /me echoue', async () => {
    const store = useAuthStore()
    store.token = 'token'
    store.user = { id: 1, nom: 'Ancien', role: 'permanent' }
    api.get.mockResolvedValueOnce({ data: { id: 1, nom: 'Nouveau', role: 'permanent' } })

    await store.fetchUser()

    expect(store.userName).toBe('Nouveau')

    api.get.mockRejectedValueOnce({ response: { status: 401 } })
    await expect(store.fetchUser()).rejects.toEqual({ response: { status: 401 } })
    expect(store.isAuthenticated).toBe(false)
  })

  it('change le mot de passe et nettoie le flag local', async () => {
    const store = useAuthStore()
    store.user = { id: 1, password_change_required: true }
    api.post.mockResolvedValueOnce({ data: { message: 'ok' } })

    await expect(store.changePassword('nouveau')).resolves.toEqual({ message: 'ok' })

    expect(api.post).toHaveBeenCalledWith('/api/auth/change-password', {
      newPassword: 'nouveau',
    })
    expect(store.user.password_change_required).toBe(false)
  })
})
