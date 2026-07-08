import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../../../src/services/api'
import { installPiniaStoreTest } from './storeTestUtils'

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
  installPiniaStoreTest()
})

import { useVentesStore } from '../../../../src/store/ventes'

describe('ventes store', () => {
  it('charge les ventes avec pagination et filtres actifs', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        ventes: [{ id: 1 }],
        pagination: { page: 2, limit: 20, total: 41, totalPages: 3 },
      },
    })
    const store = useVentesStore()
    store.filters.type_paiement = 'CB'

    await store.fetchVentes({ page: 2, limit: 20, date_debut: '2026-07-01' })

    expect(api.get).toHaveBeenCalledWith('/api/ventes', {
      params: {
        page: 2,
        limit: 20,
        date_debut: '2026-07-01',
        type_paiement: 'CB',
      },
    })
    expect(store.ventes).toEqual([{ id: 1 }])
    expect(store.hasPrevPage).toBe(true)
    expect(store.hasNextPage).toBe(true)
    expect(store.hasActiveFilters).toBe(true)
  })

  it('applique, reinitialise les filtres et protege les pages invalides', async () => {
    api.get.mockResolvedValue({
      data: {
        ventes: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      },
    })
    const store = useVentesStore()

    await store.applyFilters({ type_paiement: 'Cheque' })
    expect(store.filters.type_paiement).toBe('Cheque')

    await store.resetFilters()
    expect(store.filters).toEqual({ date_debut: '', date_fin: '', type_paiement: '' })

    api.get.mockClear()
    store.pagination = { page: 1, limit: 10, total: 10, totalPages: 1 }
    await store.goToPage(2)
    await store.prevPage()
    await store.nextPage()
    expect(api.get).not.toHaveBeenCalled()
  })

  it('ajoute, modifie et supprime une vente puis recharge la liste', async () => {
    api.post.mockResolvedValueOnce({ data: { id: 1 } })
    api.put.mockResolvedValueOnce({ data: { message: 'ok' } })
    api.delete.mockResolvedValueOnce({ data: { message: 'ok' } })
    api.get.mockResolvedValue({
      data: {
        ventes: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      },
    })
    const store = useVentesStore()

    await store.addVente({ articles: [] })
    await store.updateVente(1, { type_paiement: 'CB' })
    await store.deleteVente(1)

    expect(api.post).toHaveBeenCalledWith('/api/ventes', { articles: [] })
    expect(api.put).toHaveBeenCalledWith('/api/ventes/1', { type_paiement: 'CB' })
    expect(api.delete).toHaveBeenCalledWith('/api/ventes/1')
    expect(api.get).toHaveBeenCalledTimes(3)
  })

  it('expose le message API en cas d erreur', async () => {
    api.get.mockRejectedValueOnce({ response: { data: { error: 'Boom ventes' } } })
    const store = useVentesStore()

    await expect(store.fetchVentes()).rejects.toEqual({
      response: { data: { error: 'Boom ventes' } },
    })
    expect(store.error).toBe('Boom ventes')
    expect(store.loading).toBe(false)
  })
})
