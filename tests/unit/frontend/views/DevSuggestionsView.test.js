// @vitest-environment happy-dom

import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../../../src/services/api'
import DevSuggestionsView from '../../../../src/views/DevSuggestionsView.vue'

const authMock = vi.hoisted(() => ({ isDev: true }))
vi.mock('../../../../src/store/auth', () => ({ useAuthStore: () => authMock }))
vi.mock('../../../../src/services/api', () => ({ default: { get: vi.fn(), patch: vi.fn() } }))

const suggestion = {
  id: 1,
  titre: 'Un export',
  description: 'Première ligne\nDeuxième ligne',
  statut: 'nouvelle',
  auteur_id: 3,
  auteur_nom: 'Alice',
  auteur_nom_boutique: 'Atelier Alice',
  created_at: '2026-10-01T10:00:00Z',
  updated_at: '2026-10-01T10:00:00Z',
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('TZ', 'UTC')
  authMock.isDev = true
  api.get.mockResolvedValue({
    data: { suggestions: [{ ...suggestion }], total: 21, page: 1, limit: 20 },
  })
})

afterEach(() => vi.unstubAllEnvs())

describe('DevSuggestionsView', () => {
  it.each([
    ['2026-01-01T23:30:00Z', '02/01/2026'],
    ['2026-06-01T22:30:00Z', '02/06/2026'],
  ])('affiche les dates en heure de Paris ete comme hiver (%s)', async (createdAt, date) => {
    api.get.mockResolvedValueOnce({
      data: {
        suggestions: [{ ...suggestion, created_at: createdAt }],
        total: 1,
        page: 1,
        limit: 20,
      },
    })
    const wrapper = mount(DevSuggestionsView)
    await flushPromises()
    expect(wrapper.find('time').text()).toContain(date)
    expect(wrapper.find('time').text()).toContain('00:30')
    expect(wrapper.find('time').attributes('datetime')).toBe(createdAt)
    expect(wrapper.text()).toContain('Dates et filtres en heure de Paris.')
  })

  it('ne charge ni ne montre les suggestions sans role dev', async () => {
    authMock.isDev = false
    const wrapper = mount(DevSuggestionsView)
    await flushPromises()
    expect(api.get).not.toHaveBeenCalled()
    expect(wrapper.text()).toBe('')
  })

  it('charge titre, auteur, date, statut et pagine avec les filtres appliques', async () => {
    const wrapper = mount(DevSuggestionsView)
    await flushPromises()
    expect(api.get).toHaveBeenCalledWith('/api/suggestions', {
      params: { ordre: 'desc', page: 1, limit: 20 },
    })
    expect(wrapper.find('summary').text()).toContain('Un export')
    expect(wrapper.find('summary').text()).toContain('Alice')
    expect(wrapper.find('summary time').attributes('datetime')).toBe(suggestion.created_at)
    expect(wrapper.find('.suggestion-status').text()).toBe('Nouvelle')
    await wrapper.find('#suggestion-status-filter').setValue('en_cours')
    await wrapper.find('#suggestion-date-from').setValue('2026-09-01')
    await wrapper.find('#suggestion-date-to').setValue('2026-10-01')
    await wrapper.find('#suggestion-order').setValue('asc')
    await wrapper.find('.suggestions-filters').trigger('submit')
    await flushPromises()
    const params = {
      statut: 'en_cours',
      date_debut: '2026-09-01',
      date_fin: '2026-10-01',
      ordre: 'asc',
      page: 1,
      limit: 20,
    }
    expect(api.get).toHaveBeenLastCalledWith('/api/suggestions', { params })
    await wrapper.find('#suggestion-status-filter').setValue('refusee')
    await wrapper.findAll('.suggestions-pagination button')[1].trigger('click')
    await flushPromises()
    expect(api.get).toHaveBeenLastCalledWith('/api/suggestions', { params: { ...params, page: 2 } })
  })

  it('garde le detail ouvert et ne change le statut qu apres confirmation explicite', async () => {
    const wrapper = mount(DevSuggestionsView)
    await flushPromises()
    const detail = wrapper.find('details')
    detail.element.open = true
    await wrapper.find('#suggestion-status-1').setValue('acceptee')
    expect(api.patch).not.toHaveBeenCalled()
    api.patch.mockResolvedValue({ data: { suggestion: { ...suggestion, statut: 'acceptee' } } })
    await wrapper.find('.suggestion-status-form').trigger('submit')
    await flushPromises()
    expect(api.patch).toHaveBeenCalledWith('/api/suggestions/1/statut', { statut: 'acceptee' })
    expect(wrapper.find('.suggestion-status').text()).toBe('Acceptée')
    expect(wrapper.find('.suggestion-detail [role="status"]').text()).toBe('Statut mis à jour.')
    expect(detail.element.open).toBe(true)
    expect(api.get).toHaveBeenCalledTimes(1)
  })

  it('conserve le statut precedent et la selection si la mise a jour echoue', async () => {
    api.patch.mockRejectedValue({ response: { data: { error: 'Modification refusée' } } })
    const wrapper = mount(DevSuggestionsView)
    await flushPromises()
    await wrapper.find('#suggestion-status-1').setValue('refusee')
    await wrapper.find('.suggestion-status-form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('.suggestion-status').text()).toBe('Nouvelle')
    expect(wrapper.find('#suggestion-status-1').element.value).toBe('refusee')
    expect(wrapper.find('[role="alert"]').text()).toBe('Modification refusée')
  })

  it('signale une suggestion hors filtre apres mise a jour sans fermer le detail ni recharger', async () => {
    const wrapper = mount(DevSuggestionsView)
    await flushPromises()
    await wrapper.find('#suggestion-status-filter').setValue('nouvelle')
    await wrapper.find('.suggestions-filters').trigger('submit')
    await flushPromises()
    await wrapper.find('#suggestion-status-filter').setValue('acceptee')
    const detail = wrapper.find('details')
    detail.element.open = true
    await wrapper.find('#suggestion-status-1').setValue('acceptee')
    api.patch.mockResolvedValueOnce({ data: { suggestion: { ...suggestion, statut: 'acceptee' } } })
    await wrapper.find('.suggestion-status-form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('.suggestion-detail [role="status"]').text()).toBe(
      'Statut mis à jour. Cette suggestion ne correspond plus au filtre ; actualisez la liste.',
    )
    expect(detail.element.open).toBe(true)
    expect(api.get).toHaveBeenCalledTimes(2)
  })

  it('bloque les doubles validations de statut et la pagination pendant la sauvegarde', async () => {
    let resolve
    api.patch.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const wrapper = mount(DevSuggestionsView)
    await flushPromises()
    await wrapper.find('#suggestion-status-1').setValue('en_cours')
    await wrapper.find('.suggestion-status-form').trigger('submit')
    await wrapper.find('.suggestion-status-form').trigger('submit')
    expect(api.patch).toHaveBeenCalledTimes(1)
    expect(wrapper.find('#suggestion-status-1').element.disabled).toBe(true)
    expect(
      wrapper.findAll('.suggestions-pagination button').every((button) => button.element.disabled),
    ).toBe(true)
    resolve({ data: { suggestion: { ...suggestion, statut: 'en_cours' } } })
    await flushPromises()
    expect(wrapper.find('#suggestion-status-1').element.disabled).toBe(false)
    expect(wrapper.findAll('.suggestions-pagination button')[1].element.disabled).toBe(false)
  })

  it('annonce les erreurs de chargement et les resultats vides', async () => {
    api.get.mockRejectedValueOnce(new Error('network'))
    const wrapper = mount(DevSuggestionsView)
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toContain('Impossible de charger')
    api.get.mockResolvedValueOnce({ data: { suggestions: [], total: 0, page: 1, limit: 20 } })
    await wrapper.find('.suggestions-list-header button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.find('.empty-state').text()).toContain('Aucune suggestion')
  })

  it('refuse une periode inversee sans requete', async () => {
    const wrapper = mount(DevSuggestionsView)
    await flushPromises()
    await wrapper.find('#suggestion-date-from').setValue('2026-10-02')
    await wrapper.find('#suggestion-date-to').setValue('2026-10-01')
    await wrapper.find('.suggestions-filters').trigger('submit')
    expect(api.get).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[role="alert"]').text()).toContain('date de fin')
  })
})
