// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { artisansFixture, ventesFixture } from '../../fixtures/salesFixtures'

const artisansStoreMock = vi.hoisted(() => ({
  artisans: [],
  fetchArtisans: vi.fn(async () => []),
  getArtisanName: vi.fn(),
}))

vi.mock('../../../../src/store/artisans', () => ({
  useArtisansStore: () => artisansStoreMock,
}))

const artisans = artisansFixture
const ventes = ventesFixture

beforeEach(() => {
  artisansStoreMock.artisans = artisans
  artisansStoreMock.fetchArtisans.mockClear()
  artisansStoreMock.fetchArtisans.mockResolvedValue(artisans)
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

    expect(wrapper.text()).toContain('Atelier Alice')
    expect(wrapper.text()).toContain('Admin')
    expect(wrapper.text()).toContain('Bol')
    expect(wrapper.text()).not.toContain('Tasse')

    await wrapper.find('.btn-expand').trigger('click')
    expect(wrapper.text()).toContain('Tasse')
    expect(wrapper.text()).toContain('Commission CB personnalisée')

    await wrapper.find('button[title="Modifier"]').trigger('click')
    await wrapper.find('button[title="Supprimer"]').trigger('click')
    expect(wrapper.emitted('edit')[0]).toEqual([ventes[0]])
    expect(wrapper.emitted('delete')[0]).toEqual([10])
  })
})
