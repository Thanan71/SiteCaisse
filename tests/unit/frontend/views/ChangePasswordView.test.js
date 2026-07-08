// @vitest-environment happy-dom

import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../../../src/services/api'
import { useAuthStore } from '../../../../src/store/auth'
import ChangePasswordView from '../../../../src/views/ChangePasswordView.vue'
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

describe('ChangePasswordView', () => {
  it('bloque les mots de passe differents ou trop courts', async () => {
    const wrapper = mount(ChangePasswordView)

    await wrapper.find('#new-password').setValue('abcd')
    await wrapper.find('#confirm-password').setValue('abce')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.text()).toContain('Les nouveaux mots de passe ne correspondent pas')
    expect(api.post).not.toHaveBeenCalled()

    await wrapper.find('#new-password').setValue('abc')
    await wrapper.find('#confirm-password').setValue('abc')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.text()).toContain('au moins 4 caractères')
    expect(api.post).not.toHaveBeenCalled()
  })

  it('change le mot de passe puis redirige apres le message de succes', async () => {
    vi.useFakeTimers()
    api.post.mockResolvedValueOnce({ data: { message: 'ok' } })
    const authStore = useAuthStore()
    authStore.user = { id: 1, password_change_required: true }
    const wrapper = mount(ChangePasswordView)

    await wrapper.find('#new-password').setValue('nouveau')
    await wrapper.find('#confirm-password').setValue('nouveau')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(api.post).toHaveBeenCalledWith('/api/auth/change-password', {
      newPassword: 'nouveau',
    })
    expect(wrapper.text()).toContain('Mot de passe modifié avec succès')

    vi.advanceTimersByTime(1500)
    expect(routerPush).toHaveBeenCalledWith('/')
    vi.useRealTimers()
  })

  it("affiche l'erreur API en cas d'echec", async () => {
    api.post.mockRejectedValueOnce({
      response: { data: { error: 'Mot de passe refuse' } },
    })
    const wrapper = mount(ChangePasswordView)

    await wrapper.find('#new-password').setValue('nouveau')
    await wrapper.find('#confirm-password').setValue('nouveau')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Mot de passe refuse')
    expect(routerPush).not.toHaveBeenCalled()
  })
})
