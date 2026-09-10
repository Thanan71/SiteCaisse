// @vitest-environment happy-dom

import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import VenteFormModal from '../../../../src/components/VenteFormModal.vue'
import { artisansFixture, ventesFixture } from '../../fixtures/salesFixtures'

const artisansStoreMock = vi.hoisted(() => ({
  artisans: [],
  fetchArtisans: vi.fn(async () => []),
}))

const ventesStoreMock = vi.hoisted(() => ({
  addVente: vi.fn(async () => ({ id: 1 })),
  updateVente: vi.fn(async () => true),
}))

vi.mock('../../../../src/store/artisans', () => ({
  useArtisansStore: () => artisansStoreMock,
}))

vi.mock('../../../../src/store/ventes', () => ({
  useVentesStore: () => ventesStoreMock,
}))

const artisans = artisansFixture
const ventes = ventesFixture

beforeEach(() => {
  artisansStoreMock.artisans = artisans
  artisansStoreMock.fetchArtisans.mockClear()
  artisansStoreMock.fetchArtisans.mockResolvedValue(artisans)

  ventesStoreMock.addVente.mockClear()
  ventesStoreMock.addVente.mockResolvedValue({ id: 1 })
  ventesStoreMock.updateVente.mockClear()
  ventesStoreMock.updateVente.mockResolvedValue(true)
})

describe('VenteFormModal', () => {
  it('cree et modifie une vente depuis la modale', async () => {
    const createWrapper = mount(VenteFormModal, {
      props: { mode: 'create', show: true },
    })
    await flushPromises()

    await createWrapper.find('#create-vente-date').setValue('2026-07-08')
    await createWrapper.find('#create-vente-paiement').setValue('CB')
    await createWrapper.find('#create-vente-article-name-0').setValue('Bol')
    await createWrapper.find('#create-vente-article-qty-0').setValue(2)
    await createWrapper.find('#create-vente-article-artisan-0').setValue('2')
    await createWrapper.find('#create-vente-article-price-0').setValue(12)
    await createWrapper.find('form').trigger('submit')
    await flushPromises()

    expect(ventesStoreMock.addVente).toHaveBeenCalledWith({
      articles: [{ article: 'Bol', artisan_id: 2, prix: 12, quantite: 2 }],
      date_vente: '2026-07-08',
      type_paiement: 'CB',
    })
    expect(createWrapper.emitted('saved')).toHaveLength(1)
    expect(createWrapper.emitted('close')).toHaveLength(1)

    const editWrapper = mount(VenteFormModal, {
      props: {
        mode: 'edit',
        show: true,
        vente: ventes[0],
      },
    })
    await flushPromises()
    expect(editWrapper.text()).toContain('Modifier la vente')

    await editWrapper.find('form').trigger('submit')
    await flushPromises()
    expect(ventesStoreMock.updateVente).toHaveBeenCalledWith(10, {
      articles: [
        { article: 'Bol', artisan_id: 2, prix: 12, quantite: 2 },
        { article: 'Tasse', artisan_id: 3, prix: 8, quantite: 1 },
      ],
      date_vente: '2026-07-08',
      type_paiement: 'CB',
    })
    expect(editWrapper.emitted('saved')).toHaveLength(1)
  })

  it('affiche le total et place le focus sur un nouvel article', async () => {
    const wrapper = mount(VenteFormModal, {
      attachTo: document.body,
      props: { mode: 'create', show: true },
    })
    await flushPromises()

    await wrapper.find('#create-vente-article-name-0').setValue('Bol')
    await wrapper.find('#create-vente-article-qty-0').setValue(2)
    await wrapper.find('#create-vente-article-price-0').setValue(12)

    expect(wrapper.find('.sale-summary').text()).toContain('2 articles')
    expect(wrapper.find('.sale-summary').text()).toMatch(/24,00\s*€/)

    await wrapper.find('.section-title .btn').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('.article-row')).toHaveLength(2)
    expect(wrapper.find('.sale-summary').text()).toContain('2 lignes')
    expect(document.activeElement?.id).toBe('create-vente-article-name-1')

    wrapper.unmount()
  })
})
