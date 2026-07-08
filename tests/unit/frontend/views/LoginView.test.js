// @vitest-environment happy-dom

import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../../../src/services/api'
import LoginView from '../../../../src/views/LoginView.vue'
import { installViewTest } from './viewTestUtils'

const routerPush = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPush }),
}))

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
  installViewTest()
})

describe('LoginView', () => {
  it("connecte l'utilisateur et redirige vers les ventes", async () => {
    api.post.mockResolvedValueOnce({
      data: {
        token: 'token-123',
        user: { id: 1, nom: 'Alice', role: 'permanent' },
      },
    })
    const wrapper = mount(LoginView)

    await wrapper.find('#nom-boutique').setValue('Atelier Alice')
    await wrapper.find('#password').setValue('secret')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(api.post).toHaveBeenCalledWith('/api/auth/login', {
      nom_boutique: 'Atelier Alice',
      password: 'secret',
    })
    expect(routerPush).toHaveBeenCalledWith('/')
    expect(window.localStorage.getItem('token')).toBe('token-123')
  })

  it('redirige vers le changement de mot de passe si le backend le demande', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        password_change_required: true,
        token: 'token-456',
        user: { id: 2, nom: 'Bob', role: 'temporaire' },
      },
    })
    const wrapper = mount(LoginView)

    await wrapper.find('#nom-boutique').setValue('Atelier Bob')
    await wrapper.find('#password').setValue('secret')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(routerPush).toHaveBeenCalledWith({ name: 'ChangePassword' })
  })

  it("affiche l'erreur API sans redirection", async () => {
    api.post.mockRejectedValueOnce({
      response: { data: { error: 'Identifiants invalides' } },
    })
    const wrapper = mount(LoginView)

    await wrapper.find('#nom-boutique').setValue('Atelier Alice')
    await wrapper.find('#password').setValue('wrong')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Identifiants invalides')
    expect(routerPush).not.toHaveBeenCalled()
  })
})
