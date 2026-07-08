// @vitest-environment happy-dom

import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../../../src/services/api'
import VentesView from '../../../../src/views/VentesView.vue'
import { commonViewStubs, getCurrentDateParts, installViewTest } from './viewTestUtils'

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
  api.delete.mockResolvedValue({ data: { message: 'ok' } })
})

const ventesViewStubs = {
  ...commonViewStubs,
  ConfirmModal: {
    emits: ['cancel', 'confirm'],
    props: ['show'],
    template: `
      <div v-if="show" data-testid="confirm-delete">
        <button type="button" @click="$emit('confirm')">confirmer</button>
        <button type="button" @click="$emit('cancel')">annuler</button>
      </div>
    `,
  },
  MonthSelector: {
    emits: ['change', 'update:modelValue'],
    props: ['modelValue'],
    template: `
      <section data-testid="month-selector">
        <button
          type="button"
          @click="$emit('update:modelValue', '2026-06'); $emit('change')"
        >
          changer mois
        </button>
        <slot name="actions" />
      </section>
    `,
  },
  VenteFormModal: {
    emits: ['close', 'saved'],
    props: ['mode', 'show', 'vente'],
    template: `
      <section v-if="show" :data-testid="'vente-form-' + mode">
        <button type="button" @click="$emit('saved')">sauver</button>
        <button type="button" @click="$emit('close')">fermer</button>
      </section>
    `,
  },
  VentesTable: {
    emits: ['delete', 'edit'],
    name: 'VentesTable',
    props: ['ventes', 'summary'],
    template: `
      <section data-testid="ventes-table">
        <span data-testid="ventes-count">{{ ventes.length }}</span>
        <button type="button" @click="$emit('edit', ventes[0])">modifier</button>
        <button type="button" @click="$emit('delete', ventes[0]?.id)">supprimer</button>
      </section>
    `,
  },
}

function setupApiResponses() {
  const { currentDateISO, currentMonth } = getCurrentDateParts()
  const dailyVente = {
    id: 10,
    articles: [{ article: 'Bol', prix: 12, quantite: 2 }],
    created_at: `${currentDateISO}T10:00:00Z`,
    date_vente: currentDateISO,
    total_articles: 2,
    total_montant: 24,
    type_paiement: 'CB',
  }
  const monthlyRapport = {
    groupes: [
      {
        artisan_id: 1,
        artisan_nom: 'Atelier Alice',
        summary: { total_articles: 1, total_cb: 12, total_commission: 1, total_montant: 12 },
        ventes: [
          {
            id: 20,
            articles: [{ article: 'Bol', prix: 12, quantite: 1 }],
            created_at: '2026-06-05T08:00:00Z',
            type_paiement: 'CB',
          },
        ],
      },
      {
        artisan_id: 2,
        artisan_nom: 'Boutique Bruno',
        summary: { total_articles: 2, total_cb: 0, total_commission: 0, total_montant: 30 },
        ventes: [
          {
            id: 20,
            articles: [{ article: 'Tasse', prix: 15, quantite: 2 }],
            created_at: '2026-06-05T08:00:00Z',
            type_paiement: 'CB',
          },
        ],
      },
    ],
    parametres: { commission_cb_permanent: 1.5, commission_cb_temporaire: 2.5 },
    total: { total_articles: 3, total_cb: 12, total_commission: 1, total_montant: 42 },
  }

  api.get.mockImplementation((url, options = {}) => {
    if (url === '/api/ventes') {
      return Promise.resolve({
        data: {
          pagination: { limit: options.params?.limit || 10, page: 1, total: 1, totalPages: 1 },
          ventes: [dailyVente],
        },
      })
    }

    if (
      url === `/api/rapports/mensuel/${currentMonth}` ||
      url === '/api/rapports/mensuel/2026-06'
    ) {
      return Promise.resolve({ data: monthlyRapport })
    }

    throw new Error(`URL API inattendue: ${url}`)
  })

  return { currentDateISO, currentMonth, dailyVente, monthlyRapport }
}

function mountVentesView() {
  const fixtures = setupApiResponses()
  const wrapper = mount(VentesView, {
    global: { stubs: ventesViewStubs },
  })

  return { fixtures, wrapper }
}

describe('VentesView', () => {
  it('charge les ventes du jour et le rapport mensuel au montage', async () => {
    const { fixtures, wrapper } = mountVentesView()
    await flushPromises()

    expect(api.get).toHaveBeenCalledWith('/api/ventes', {
      params: {
        date_debut: fixtures.currentDateISO,
        date_fin: fixtures.currentDateISO,
        limit: 1000,
        page: 1,
      },
    })
    expect(api.get).toHaveBeenCalledWith(`/api/rapports/mensuel/${fixtures.currentMonth}`)
    expect(wrapper.find('[data-testid="ventes-count"]').text()).toBe('1')
    expect(wrapper.text()).toContain('Résumé du jour')
  })

  it('applique puis reinitialise les filtres sans changer de responsabilite', async () => {
    const { wrapper } = mountVentesView()
    await flushPromises()

    await wrapper.find('#filter-type-paiement').setValue('CB')
    await wrapper.find('.filter-actions .btn-primary').trigger('click')
    await flushPromises()

    expect(api.get).toHaveBeenLastCalledWith('/api/ventes', {
      params: expect.objectContaining({ page: 1, type_paiement: 'CB' }),
    })
    expect(wrapper.text()).toContain('Filtres actifs')

    await wrapper.find('.filter-actions .btn-secondary').trigger('click')
    await flushPromises()

    expect(api.get).toHaveBeenLastCalledWith('/api/ventes', {
      params: { limit: 1000, page: 1 },
    })
  })

  it('ouvre la modification et confirme la suppression via les composants enfants', async () => {
    const { wrapper } = mountVentesView()
    await flushPromises()

    await wrapper.find('[data-testid="ventes-table"] button').trigger('click')
    expect(wrapper.find('[data-testid="vente-form-edit"]').exists()).toBe(true)

    await wrapper.findAll('[data-testid="ventes-table"] button')[1].trigger('click')
    expect(wrapper.find('[data-testid="confirm-delete"]').exists()).toBe(true)

    await wrapper.find('[data-testid="confirm-delete"] button').trigger('click')
    await flushPromises()

    expect(api.delete).toHaveBeenCalledWith('/api/ventes/10')
    expect(wrapper.find('[data-testid="confirm-delete"]').exists()).toBe(false)
  })

  it('prepare les ventes mensuelles en fusionnant les groupes par vente', async () => {
    const { wrapper } = mountVentesView()
    await flushPromises()

    await wrapper.find('[data-testid="tab-mensuel"]').trigger('click')
    await flushPromises()

    const table = wrapper.findComponent({ name: 'VentesTable' })
    expect(table.props('ventes')).toEqual([
      expect.objectContaining({
        artisan_nom: 'Atelier Alice, Boutique Bruno',
        id: 20,
        total_articles: 3,
        total_montant: 42,
      }),
    ])
  })
})
