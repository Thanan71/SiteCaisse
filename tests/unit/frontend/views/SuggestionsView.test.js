// @vitest-environment happy-dom

import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../../../src/services/api'
import SuggestionsView from '../../../../src/views/SuggestionsView.vue'

vi.mock('../../../../src/services/api', () => ({ default: { post: vi.fn(), get: vi.fn() } }))

const suggestion = {
  id: 1,
  titre: 'Un export',
  description: 'Première ligne\nDeuxième ligne',
  statut: 'terminee',
  created_at: '2026-09-30T22:30:00Z',
}

beforeEach(() => {
  vi.resetAllMocks()
  api.get.mockResolvedValue({ data: { suggestions: [], total: 0, page: 1, limit: 20 } })
})

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

  it('charge ses suggestions et affiche leur etat sans controle de modification', async () => {
    api.get.mockResolvedValueOnce({
      data: { suggestions: [{ ...suggestion }], total: 1, page: 1, limit: 20 },
    })
    const wrapper = mount(SuggestionsView)
    await flushPromises()
    expect(api.get).toHaveBeenCalledWith('/api/suggestions/mes', { params: { page: 1, limit: 20 } })
    const personalSuggestions = wrapper.find('.personal-suggestions')
    expect(personalSuggestions.find('h2').text()).toBe('Mes suggestions')
    expect(personalSuggestions.find('summary').text()).toContain('Un export')
    expect(personalSuggestions.find('.suggestion-status').text()).toBe('Terminé')
    expect(personalSuggestions.find('time').text()).toContain('01/10/2026')
    expect(personalSuggestions.find('time').text()).toContain('00:30')
    expect(personalSuggestions.find('.suggestion-description').text()).toBe(suggestion.description)
    expect(personalSuggestions.find('select').exists()).toBe(false)
    expect(personalSuggestions.find('form').exists()).toBe(false)
  })

  it('pagine et actualise les statuts sans perdre la suggestion en cours de saisie', async () => {
    api.get.mockResolvedValueOnce({
      data: { suggestions: [{ ...suggestion, statut: 'en_cours' }], total: 21, page: 1, limit: 20 },
    })
    const wrapper = mount(SuggestionsView)
    await flushPromises()
    await fillSuggestion(wrapper, 'Brouillon', 'Mon besoin')
    api.get.mockResolvedValueOnce({
      data: { suggestions: [{ ...suggestion, id: 21 }], total: 21, page: 2, limit: 20 },
    })
    await wrapper.findAll('.suggestions-pagination button')[1].trigger('click')
    await flushPromises()
    expect(api.get).toHaveBeenLastCalledWith('/api/suggestions/mes', {
      params: { page: 2, limit: 20 },
    })
    expect(wrapper.find('.suggestions-pagination').text()).toContain('Page 2 / 2')
    api.get.mockResolvedValueOnce({
      data: {
        suggestions: [{ ...suggestion, id: 21, statut: 'refusee' }],
        total: 21,
        page: 2,
        limit: 20,
      },
    })
    await wrapper.find('.personal-suggestions .suggestions-list-header button').trigger('click')
    await flushPromises()
    expect(wrapper.find('.personal-suggestions .suggestion-status').text()).toBe('Refusée')
    expect(wrapper.find('#suggestion-title').element.value).toBe('Brouillon')
    expect(wrapper.find('#suggestion-description').element.value).toBe('Mon besoin')
  })

  it('revient a la premiere page apres envoi et montre la nouvelle suggestion', async () => {
    api.get.mockResolvedValueOnce({
      data: { suggestions: [{ ...suggestion }], total: 21, page: 1, limit: 20 },
    })
    const wrapper = mount(SuggestionsView)
    await flushPromises()
    api.get.mockResolvedValueOnce({
      data: { suggestions: [{ ...suggestion }], total: 21, page: 2, limit: 20 },
    })
    await wrapper.findAll('.suggestions-pagination button')[1].trigger('click')
    await flushPromises()
    await fillSuggestion(wrapper, 'Nouvelle idée', 'Mon besoin')
    api.post.mockResolvedValueOnce({ data: { suggestion: { id: 22 } } })
    api.get.mockResolvedValueOnce({
      data: {
        suggestions: [{ ...suggestion, id: 22, titre: 'Nouvelle idée', statut: 'nouvelle' }],
        total: 22,
        page: 1,
        limit: 20,
      },
    })
    await wrapper.find('.suggestion-form').trigger('submit')
    await flushPromises()
    expect(api.get).toHaveBeenLastCalledWith('/api/suggestions/mes', {
      params: { page: 1, limit: 20 },
    })
    expect(wrapper.find('.personal-suggestions [data-suggestion-id="22"]').text()).toContain(
      'Nouvelle idée',
    )
    expect(wrapper.find('.suggestions-pagination').text()).toContain('Page 1 / 2')
    expect(wrapper.find('.suggestion-form [role="status"]').text()).toContain('bien été envoyée')
  })

  it('separe les erreurs de liste du formulaire et propose de reessayer', async () => {
    api.get.mockRejectedValueOnce({ response: { data: { error: 'Chargement indisponible' } } })
    const wrapper = mount(SuggestionsView)
    await flushPromises()
    await fillSuggestion(wrapper, 'Mon titre', 'Mon besoin')
    expect(wrapper.find('.personal-suggestions [role="alert"]').text()).toBe(
      'Chargement indisponible',
    )
    expect(wrapper.find('.suggestion-form [role="alert"]').exists()).toBe(false)
    expect(wrapper.find('.personal-suggestions .empty-state').exists()).toBe(false)
    await wrapper.find('.personal-suggestions .suggestions-list-header button').trigger('click')
    await flushPromises()
    expect(wrapper.find('.personal-suggestions [role="alert"]').exists()).toBe(false)
    expect(wrapper.find('.personal-suggestions .empty-state').text()).toContain('pas encore envoyé')
    expect(wrapper.find('#suggestion-title').element.value).toBe('Mon titre')
  })

  it('conserve la confirmation d envoi si le rechargement de ses suggestions echoue', async () => {
    const wrapper = mount(SuggestionsView)
    await flushPromises()
    await fillSuggestion(wrapper)
    api.post.mockResolvedValueOnce({ data: { suggestion: { id: 1 } } })
    api.get.mockRejectedValueOnce(new Error('network'))
    await wrapper.find('.suggestion-form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('.suggestion-form [role="status"]').text()).toContain('bien été envoyée')
    expect(wrapper.find('.suggestion-form [role="alert"]').exists()).toBe(false)
    expect(wrapper.find('.personal-suggestions [role="alert"]').text()).toContain(
      'Impossible de charger',
    )
    expect(wrapper.find('#suggestion-title').element.value).toBe('')
  })

  it('annonce le chargement et ignore une ancienne reponse apres l envoi', async () => {
    let resolveInitial
    api.get.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolveInitial = done
        }),
    )
    const wrapper = mount(SuggestionsView)
    await flushPromises()
    expect(wrapper.find('.personal-suggestions [role="status"]').text()).toContain('Chargement')
    expect(wrapper.find('.personal-suggestions .suggestions-list').attributes('aria-busy')).toBe(
      'true',
    )
    await fillSuggestion(wrapper)
    api.post.mockResolvedValueOnce({ data: { suggestion: { id: 1 } } })
    api.get.mockResolvedValueOnce({
      data: { suggestions: [{ ...suggestion }], total: 1, page: 1, limit: 20 },
    })
    await wrapper.find('.suggestion-form').trigger('submit')
    await flushPromises()
    resolveInitial({ data: { suggestions: [], total: 0, page: 1, limit: 20 } })
    await flushPromises()
    expect(wrapper.find('.personal-suggestions .suggestion-status').text()).toBe('Terminé')
    expect(wrapper.find('.personal-suggestions [role="status"]').text()).toBe('1 suggestion')
  })
})
