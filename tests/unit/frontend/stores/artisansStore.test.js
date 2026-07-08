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

import { useArtisansStore } from '../../../../src/store/artisans'

describe('artisans store', () => {
  it('charge les artisans et expose les getters', async () => {
    api.get.mockResolvedValueOnce({
      data: [
        { id: 1, nom: 'Alice', nom_boutique: 'Atelier Alice', role: 'permanent' },
        { id: 2, nom: 'Bob', role: 'temporaire', est_actif: false },
      ],
    })
    const store = useArtisansStore()

    await store.fetchArtisans({ includeInactive: true })

    expect(api.get).toHaveBeenCalledWith('/api/rapports/artisans', {
      params: { include_inactive: 'true' },
    })
    expect(store.actifs).toHaveLength(1)
    expect(store.permanents).toHaveLength(1)
    expect(store.temporaires).toHaveLength(1)
    expect(store.getArtisanName(1)).toBe('Atelier Alice')
    expect(store.getArtisanName(999)).toBe('Artisan inconnu')
  })
})
