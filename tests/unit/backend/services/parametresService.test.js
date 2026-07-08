import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase } from '../../helpers/fakeSupabase'
import { loadCjsWithMocks } from '../../helpers/loadCjsWithMocks'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('parametresService', () => {
  it('retourne les parametres sous forme cle valeur', async () => {
    const fake = createFakeSupabase({
      parametres: [
        { cle: 'commission_cb_permanent', valeur: '1.5', description: 'Permanent' },
        { cle: 'commission_cb_temporaire', valeur: '2.5', description: 'Temporaire' },
      ],
    })
    const { loaded, restore } = loadCjsWithMocks('api/services/parametresService.cjs', {
      'api/db.cjs': { getSupabase: () => fake.client },
    })

    await expect(loaded.getAllParametres()).resolves.toEqual({
      commission_cb_permanent: '1.5',
      commission_cb_temporaire: '2.5',
    })

    restore()
  })

  it('met a jour un parametre existant ou cree une nouvelle cle', async () => {
    const fake = createFakeSupabase({
      parametres: [{ cle: 'commission_cb_permanent', valeur: '1.5' }],
    })
    const { loaded, restore } = loadCjsWithMocks('api/services/parametresService.cjs', {
      'api/db.cjs': { getSupabase: () => fake.client },
    })

    await expect(loaded.updateParametre('commission_cb_permanent', '1.75')).resolves.toBe(true)
    await expect(loaded.updateParametre('nouveau_parametre', '42', 'Demo')).resolves.toBe(true)

    expect(fake.tables.parametres).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cle: 'commission_cb_permanent', valeur: '1.75' }),
        expect.objectContaining({
          cle: 'nouveau_parametre',
          valeur: '42',
          description: 'Demo',
        }),
      ]),
    )

    restore()
  })
})
