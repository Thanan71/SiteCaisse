// @vitest-environment happy-dom

import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../../../src/services/api'
import SuggestionsView from '../../../../src/views/SuggestionsView.vue'

vi.mock('../../../../src/services/api', () => ({ default: { post: vi.fn() } }))
beforeEach(() => vi.resetAllMocks())

async function fillSuggestion(
  wrapper,
  titre = '  Export mensuel  ',
  description = '  Ajouter un filtre.  ',
) {
  await wrapper.find('#suggestion-title').setValue(titre)
  await wrapper.find('#suggestion-description').setValue(description)
}

describe('SuggestionsView', () => {
  it('envoie les champs nettoyes, confirme et vide la saisie apres succes', async () => {
    api.post.mockResolvedValue({ data: { suggestion: { id: 1 } } })
    const wrapper = mount(SuggestionsView)
    await fillSuggestion(wrapper)
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(api.post).toHaveBeenCalledWith('/api/suggestions', {
      titre: 'Export mensuel',
      description: 'Ajouter un filtre.',
    })
    expect(wrapper.find('[role="status"]').text()).toContain('bien été envoyée')
    expect(wrapper.find('#suggestion-title').element.value).toBe('')
    expect(wrapper.find('#suggestion-description').element.value).toBe('')
  })

  it('conserve la saisie apres erreur et permet de reessayer', async () => {
    api.post.mockRejectedValueOnce({ response: { data: { error: 'Service indisponible' } } })
    const wrapper = mount(SuggestionsView)
    await fillSuggestion(wrapper, 'Mon titre', 'Mon besoin')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toBe('Service indisponible')
    expect(wrapper.find('#suggestion-title').element.value).toBe('Mon titre')
    expect(wrapper.find('#suggestion-description').element.value).toBe('Mon besoin')
    expect(wrapper.find('button[type="submit"]').element.disabled).toBe(false)
    api.post.mockResolvedValueOnce({ data: { suggestion: { id: 2 } } })
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.find('[role="status"]').text()).toContain('bien été envoyée')
  })

  it('bloque le double envoi et desactive les champs pendant la requete', async () => {
    let resolve
    api.post.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const wrapper = mount(SuggestionsView)
    await fillSuggestion(wrapper)
    await wrapper.find('form').trigger('submit')
    await wrapper.find('form').trigger('submit')
    expect(api.post).toHaveBeenCalledTimes(1)
    expect(wrapper.find('button[type="submit"]').element.disabled).toBe(true)
    expect(wrapper.find('#suggestion-description').element.disabled).toBe(true)
    resolve({ data: { suggestion: { id: 1 } } })
    await flushPromises()
    expect(wrapper.find('button[type="submit"]').element.disabled).toBe(false)
  })

  it.each([
    ['   ', 'Description'],
    ['Titre', '   '],
    ['x'.repeat(121), 'Description'],
    ['Titre', 'x'.repeat(2001)],
  ])('refuse les champs vides ou trop longs', async (titre, description) => {
    const wrapper = mount(SuggestionsView)
    await fillSuggestion(wrapper, titre, description)
    await wrapper.find('form').trigger('submit')
    expect(api.post).not.toHaveBeenCalled()
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
  })

  it('expose limites et compteurs aux utilisateurs', async () => {
    const wrapper = mount(SuggestionsView)
    await fillSuggestion(wrapper, 'Titre', 'Description')
    expect(wrapper.find('#suggestion-title').attributes('maxlength')).toBe('120')
    expect(wrapper.find('#suggestion-description').attributes('maxlength')).toBe('2000')
    expect(wrapper.find('#suggestion-title-count').text()).toBe('5 / 120 caractères')
    expect(wrapper.find('#suggestion-description-count').text()).toBe('11 / 2000 caractères')
  })
})
