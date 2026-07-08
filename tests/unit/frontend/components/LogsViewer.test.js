// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import LogsViewer from '../../../../src/components/LogsViewer.vue'

describe('logs', () => {
  it('formate les logs, filtre et pagine', async () => {
    const wrapper = mount(LogsViewer, {
      props: {
        logFilters: { action: '', cible_type: '' },
        logs: [
          {
            id: 1,
            action: 'error',
            cible_type: 'error',
            created_at: '2026-07-08T10:00:00Z',
            details: { context: 'api.test', message: 'Boom' },
          },
          {
            id: 2,
            action: 'auth.login_failed',
            cible_type: 'auth',
            created_at: '2026-07-08T10:00:00Z',
            details: '{"reason":"expired_access"}',
            user_nom: 'Alice',
            user_nom_boutique: 'Atelier Alice',
          },
          {
            id: 3,
            action: 'parametre.update',
            cible_id: 'commission_cb',
            cible_type: 'parametre',
            created_at: '2026-07-08T10:00:00Z',
            details: { cle: 'commission_cb', valeur: '1.5' },
          },
          {
            id: 4,
            action: 'user.create',
            cible_type: 'user',
            created_at: '2026-07-08T10:00:00Z',
            details: { nom: 'Zoe', nom_boutique: 'Atelier Zoe' },
          },
          {
            id: 5,
            action: 'vente.create',
            cible_type: 'vente',
            created_at: '2026-07-08T10:00:00Z',
            details: { artisan_id: 2, articles: [{}, {}], type_paiement: 'CB' },
          },
          {
            id: 6,
            action: 'vente.update',
            cible_type: 'vente',
            created_at: '2026-07-08T10:00:00Z',
            details: { modifications: { type_paiement: 'Cheque' } },
          },
        ],
        logsError: '',
        logsLoading: false,
        logsPagination: { limit: 5, page: 1, total: 6, totalPages: 2 },
      },
    })

    expect(wrapper.text()).toContain('6 actions enregistrées')
    expect(wrapper.text()).toContain('api.test : Boom')
    expect(wrapper.text()).toContain('Raison : expired_access')
    expect(wrapper.text()).toContain('commission_cb = 1.5')
    expect(wrapper.text()).toContain('Zoe (Atelier Zoe)')
    expect(wrapper.text()).toContain('CB, artisan #2, 2 articles')
    expect(wrapper.text()).toContain('Modification vente')

    await wrapper.find('button').trigger('click')
    await wrapper.find('#log-action').setValue('vente.create')
    await wrapper.find('#log-cible').setValue('vente')
    await wrapper.findAll('.pagination-controls button')[1].trigger('click')

    expect(wrapper.emitted('fetch')).toHaveLength(1)
    expect(wrapper.emitted('update:log-filters')[0]).toEqual([
      { action: 'vente.create', cible_type: '' },
    ])
    expect(wrapper.emitted('update:log-filters')[1]).toEqual([{ action: '', cible_type: 'vente' }])
    expect(wrapper.emitted('change-page')[0]).toEqual([2])
  })
})
