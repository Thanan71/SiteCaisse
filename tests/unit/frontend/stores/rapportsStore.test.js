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

import { useRapportsStore } from '../../../../src/store/rapports'

describe('rapports store', () => {
  it('charge les rapports globaux, artisan et mensuel', async () => {
    api.get
      .mockResolvedValueOnce({
        data: {
          groupes: [{ artisan_id: 1 }],
          total: { total_articles: 2 },
          parametres: { commission_cb_permanent: 1.5 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          ventes: [{ id: 1 }],
          summary: { total_articles: 1, total_montant: 10 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          groupes: [{ artisan_id: 1 }],
          total: { total_articles: 1 },
        },
      })
    const store = useRapportsStore()

    await store.fetchAllRapports()
    await store.fetchVentesByArtisan(1)
    await store.fetchRapportByMonth('2026-07')

    expect(store.allRapports).toEqual([{ artisan_id: 1 }])
    expect(store.totalGlobal).toEqual({ total_articles: 2 })
    expect(store.totalAllParams).toEqual({ commission_cb_permanent: 1.5 })
    expect(store.selectedArtisanId).toBe(1)
    expect(store.ventesArtisan).toEqual([{ id: 1 }])
    expect(store.rapportMois.total).toEqual({ total_articles: 1 })
  })

  it('remonte une erreur de chargement de rapport', async () => {
    api.get.mockRejectedValueOnce({ response: { data: { error: 'Rapport KO' } } })
    const store = useRapportsStore()

    await expect(store.fetchAllRapports()).rejects.toEqual({
      response: { data: { error: 'Rapport KO' } },
    })
    expect(store.error).toBe('Rapport KO')
  })
})
