import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../../../src/services/api'

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
  vi.clearAllMocks()
  vi.stubGlobal('alert', vi.fn())
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

import { useCommissions } from '../../../../src/composables/useCommissions'

describe('useCommissions', () => {
  it('charge et sauvegarde les commissions', async () => {
    vi.useFakeTimers()
    api.get.mockResolvedValueOnce({
      data: {
        commission_cb_permanent: '1.50',
        commission_cb_temporaire: '2.50',
      },
    })
    api.put.mockResolvedValue({})
    const commissions = useCommissions()

    await commissions.fetchParametres()
    expect(commissions.commissionPermanent.value).toBe('1.50')
    expect(commissions.commissionTemporaire.value).toBe('2.50')

    commissions.commissionPermanent.value = '1.75'
    commissions.commissionTemporaire.value = '2.75'
    await commissions.handleSaveCommissions()

    expect(api.put).toHaveBeenNthCalledWith(1, '/api/admin/parametres/commission_cb_permanent', {
      valeur: '1.75',
    })
    expect(api.put).toHaveBeenNthCalledWith(2, '/api/admin/parametres/commission_cb_temporaire', {
      valeur: '2.75',
    })
    expect(commissions.commissionsSuccess.value).toBe('Commissions CB mises à jour avec succès !')

    vi.advanceTimersByTime(3000)
    expect(commissions.commissionsSuccess.value).toBe('')
  })

  it('affiche une erreur de sauvegarde des commissions', async () => {
    api.put.mockRejectedValueOnce({ response: { data: { error: 'Taux invalide' } } })
    const commissions = useCommissions()

    await commissions.handleSaveCommissions()

    expect(commissions.commissionsError.value).toBe('Taux invalide')
    expect(commissions.savingCommissions.value).toBe(false)
  })
})
