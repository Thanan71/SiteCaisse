// @vitest-environment happy-dom

import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../../../src/services/api'
import {
  exportAllRapportsToExcel,
  exportMonthToExcel,
  exportVentesToExcel,
} from '../../../../src/services/excelService'
import RapportsView from '../../../../src/views/RapportsView.vue'
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

vi.mock('../../../../src/services/excelService', () => ({
  exportAllRapportsToExcel: vi.fn(),
  exportMonthToExcel: vi.fn(),
  exportVentesToExcel: vi.fn(),
}))

beforeEach(() => {
  installViewTest()
})

const rapportsViewStubs = {
  ...commonViewStubs,
  GraphiquesRapports: {
    name: 'GraphiquesRapports',
    props: ['ventesData', 'isGlobal', 'groupesData'],
    template: '<section data-testid="graphiques-rapports">{{ ventesData.length }}</section>',
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
  RapportVentesTable: {
    name: 'RapportVentesTable',
    props: ['title', 'ventes', 'summary', 'totalLabel'],
    template: '<section data-testid="rapport-table">{{ title }} {{ ventes.length }}</section>',
  },
}

function setupApiResponses() {
  const { currentMonth } = getCurrentDateParts()
  const artisans = [
    { id: 1, nom: 'Alice', nom_boutique: 'Atelier Alice', role: 'permanent' },
    {
      est_actif: false,
      id: 2,
      nom: 'Bruno',
      nom_boutique: 'Boutique Bruno',
      role: 'temporaire',
    },
  ]
  const allRapports = [
    {
      artisan_id: 1,
      artisan_nom: 'Atelier Alice',
      summary: { total_articles: 1, total_cb: 24, total_commission: 1, total_montant: 24 },
      ventes: [{ id: 10, total_montant: 24, type_paiement: 'CB' }],
    },
  ]
  const totalGlobal = {
    total_articles: 1,
    total_cb: 24,
    total_commission: 1,
    total_montant: 24,
  }
  const parametres = { commission_cb_permanent: 1.5, commission_cb_temporaire: 2.5 }
  const artisanVentes = [{ id: 20, total_montant: 30, type_paiement: 'Cheque' }]
  const artisanSummary = { total_articles: 2, total_montant: 30 }
  const monthlyRapport = {
    groupes: [
      allRapports[0],
      {
        artisan_id: 2,
        artisan_nom: 'Boutique Bruno',
        summary: { total_articles: 2, total_cb: 0, total_commission: 0, total_montant: 30 },
        ventes: artisanVentes,
      },
    ],
    parametres,
    total: { total_articles: 3, total_cb: 24, total_commission: 1, total_montant: 54 },
  }

  api.get.mockImplementation((url) => {
    if (url === '/api/rapports/artisans') {
      return Promise.resolve({ data: artisans })
    }

    if (url === '/api/rapports') {
      return Promise.resolve({ data: { groupes: allRapports, parametres, total: totalGlobal } })
    }

    if (
      url === `/api/rapports/mensuel/${currentMonth}` ||
      url === '/api/rapports/mensuel/2026-06'
    ) {
      return Promise.resolve({ data: monthlyRapport })
    }

    if (url === '/api/rapports/2') {
      return Promise.resolve({ data: { summary: artisanSummary, ventes: artisanVentes } })
    }

    throw new Error(`URL API inattendue: ${url}`)
  })

  return {
    allRapports,
    artisanSummary,
    artisanVentes,
    artisans,
    currentMonth,
    monthlyRapport,
    parametres,
    totalGlobal,
  }
}

function mountRapportsView() {
  const fixtures = setupApiResponses()
  const wrapper = mount(RapportsView, {
    global: { stubs: rapportsViewStubs },
  })

  return { fixtures, wrapper }
}

function findButtonByText(wrapper, text) {
  const button = wrapper.findAll('button').find((candidate) => candidate.text().includes(text))

  if (!button) {
    throw new Error(`Bouton introuvable: ${text}`)
  }

  return button
}

describe('RapportsView', () => {
  it('charge les donnees globales et exporte tous les rapports', async () => {
    const { fixtures, wrapper } = mountRapportsView()
    await flushPromises()

    expect(api.get).toHaveBeenCalledWith('/api/rapports/artisans', {
      params: { include_inactive: 'true' },
    })
    expect(api.get).toHaveBeenCalledWith('/api/rapports')
    expect(wrapper.find('#artisan-select').text()).toContain('Atelier Alice')
    expect(wrapper.find('#artisan-select').text()).toContain('Boutique Bruno (archivé)')

    await findButtonByText(wrapper, 'Télécharger tout').trigger('click')

    expect(exportAllRapportsToExcel).toHaveBeenCalledWith(
      fixtures.allRapports,
      fixtures.totalGlobal,
      fixtures.parametres,
    )
  })

  it('charge un artisan specifique et delegue son export au store', async () => {
    const { fixtures, wrapper } = mountRapportsView()
    await flushPromises()

    await wrapper.find('#artisan-select').setValue('2')
    await flushPromises()

    expect(api.get).toHaveBeenCalledWith('/api/rapports/2')
    expect(wrapper.text()).toContain('Télécharger en Excel')

    await findButtonByText(wrapper, 'Télécharger en Excel').trigger('click')

    expect(exportVentesToExcel).toHaveBeenCalledWith(
      fixtures.artisanVentes,
      fixtures.artisans,
      2,
      fixtures.artisanSummary,
    )
  })

  it('alimente les graphiques avec les ventes aplaties en vue globale', async () => {
    const { wrapper } = mountRapportsView()
    await flushPromises()

    await wrapper.find('[data-testid="tab-graphiques"]').trigger('click')
    await flushPromises()

    const graphiques = wrapper.findComponent({ name: 'GraphiquesRapports' })
    expect(graphiques.props('isGlobal')).toBe(true)
    expect(graphiques.props('ventesData')).toEqual([
      { id: 10, total_montant: 24, type_paiement: 'CB' },
    ])
  })

  it('exporte le rapport mensuel global puis celui de l artisan selectionne', async () => {
    const { fixtures, wrapper } = mountRapportsView()
    await flushPromises()

    await wrapper.find('[data-testid="tab-mensuel"]').trigger('click')
    await flushPromises()
    await findButtonByText(wrapper, 'Télécharger le rapport Excel').trigger('click')

    expect(exportMonthToExcel).toHaveBeenCalledWith(
      fixtures.monthlyRapport.groupes,
      fixtures.monthlyRapport.total,
      fixtures.parametres,
      fixtures.currentMonth,
    )

    await wrapper.find('#artisan-select').setValue('2')
    await flushPromises()
    await wrapper.find('[data-testid="tab-mensuel"]').trigger('click')
    await flushPromises()
    await findButtonByText(wrapper, 'Télécharger le rapport Excel').trigger('click')

    expect(exportMonthToExcel).toHaveBeenLastCalledWith(
      [fixtures.monthlyRapport.groupes[1]],
      fixtures.monthlyRapport.groupes[1].summary,
      fixtures.parametres,
      fixtures.currentMonth,
    )
  })
})
