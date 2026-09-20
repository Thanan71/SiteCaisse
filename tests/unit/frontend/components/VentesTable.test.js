// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { artisansFixture, ventesFixture } from '../../fixtures/salesFixtures'

const artisansStoreMock = vi.hoisted(() => ({
  artisans: [],
  fetchSaleArtisans: vi.fn(async () => []),
  getArtisanName: vi.fn(),
}))

vi.mock('../../../../src/store/artisans', () => ({
  useArtisansStore: () => artisansStoreMock,
}))

const artisans = artisansFixture
const ventes = ventesFixture

beforeEach(() => {
  artisansStoreMock.artisans = artisans
  artisansStoreMock.fetchSaleArtisans.mockClear()
  artisansStoreMock.fetchSaleArtisans.mockResolvedValue(artisans)
  artisansStoreMock.getArtisanName.mockReset()
  artisansStoreMock.getArtisanName.mockImplementation((id) => {
    if (id === 2) return 'Atelier Alice'
    if (id === 3) return 'Boutique Bruno'
    return 'Artisan inconnu'
  })
})

import VentesTable from '../../../../src/components/VentesTable.vue'

describe('VentesTable', () => {
  it('rend les ventes, deploie les articles et emet les actions', async () => {
    const wrapper = mount(VentesTable, {
      props: {
        rowKeyPrefix: 'test-',
        showActions: true,
        showArtisan: true,
        showVendeur: true,
        summary: {
          commission_cb: 1.2,
          commission_personnalisee: true,
          taux_commission: 1.5,
          total_articles: 3,
          total_cb: 32,
          total_montant: 32,
        },
        ventes,
      },
    })

    expect(artisansStoreMock.fetchSaleArtisans).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('Atelier Alice')
    expect(wrapper.text()).toContain('Admin')
    expect(wrapper.text()).toContain('Bol')
    expect(wrapper.text()).not.toContain('Tasse')

    await wrapper.find('.btn-expand').trigger('click')
    expect(wrapper.text()).toContain('Tasse')
    expect(wrapper.text()).toContain('Commission personnalisée')
    expect(wrapper.find('.commission-label').text()).toContain('32,00')
    expect(wrapper.find('.commission-label').text()).toContain(', CB)')

    await wrapper.find('button[title="Modifier"]').trigger('click')
    await wrapper.find('button[title="Supprimer"]').trigger('click')
    expect(wrapper.emitted('edit')[0]).toEqual([ventes[0]])
    expect(wrapper.emitted('delete')[0]).toEqual([10])
  })

  it.each([
    false,
    true,
  ])('affiche la commission invite sur tous les paiements (personnalisee : %s)', (personnalisee) => {
    const wrapper = mount(VentesTable, {
      props: {
        summary: {
          assiette_commission: 'tous_paiements',
          commission_cb: 5,
          commission_personnalisee: personnalisee,
          taux_commission: 10,
          total_articles: 3,
          total_cb: 20,
          total_montant: 50,
        },
        ventes: [],
      },
    })

    const label = wrapper.find('.commission-label').text()
    expect(label).toContain(personnalisee ? 'Commission personnalisée' : 'Commission (')
    expect(label).toContain('10% sur 50,00')
    expect(label).toContain('tous paiements')
    expect(label).not.toContain('20,00')
    expect(wrapper.find('.commission-value').text()).toContain('5,00')
  })

  it('affiche uniquement le montant CB comme assiette pour un permanent', () => {
    const wrapper = mount(VentesTable, {
      props: {
        summary: {
          assiette_commission: 'cb',
          commission_cb: 2,
          taux_commission: 10,
          total_articles: 3,
          total_cb: 20,
          total_montant: 50,
        },
        ventes: [],
      },
    })

    const label = wrapper.find('.commission-label').text()
    expect(label).toContain('10% sur 20,00')
    expect(label).toContain(', CB)')
    expect(label).not.toContain('50,00')
  })
})
