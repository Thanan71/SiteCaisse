import crypto from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase } from '../../helpers/fakeSupabase'
import { loadCjsWithMocks } from '../../helpers/loadCjsWithMocks'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('adminUserService', () => {
  beforeEach(() => {
    vi.spyOn(crypto, 'randomInt').mockReturnValue(42)
  })

  function loadAdminService(fake, modelMocks = {}) {
    return loadCjsWithMocks('api/services/adminUserService.cjs', {
      'api/db.cjs': { getSupabase: () => fake.client },
      'api/models.cjs': {
        extendUserDateFin: vi.fn(),
        resetUserPassword: vi.fn(async (_userId, password) => password),
        ...modelMocks,
      },
    })
  }

  it('cree un utilisateur avec mot de passe normalise et changement obligatoire', async () => {
    const fake = createFakeSupabase({ users: [] })
    const { loaded, restore } = loadAdminService(fake)

    const result = await loaded.createUser({
      nom: 'Zoe',
      nom_boutique: 'Atelier Zoé !',
      role: 'temporaire',
      date_fin: '2026-08-01',
    })

    expect(result.newPassword).toBe('atelierzoe0042')
    expect(result.user).toMatchObject({
      id: 1,
      nom: 'Zoe',
      nom_boutique: 'Atelier Zoé !',
      generated_password: 'atelierzoe0042',
      role: 'temporaire',
      password_change_required: true,
      date_fin: '2026-08-01',
    })
    expect(fake.tables.users[0].password_hash).not.toBe('atelierzoe0042')

    restore()
  })

  it('refuse un nom de boutique deja existant', async () => {
    const fake = createFakeSupabase({
      users: [{ id: 1, nom_boutique: 'Atelier Alice' }],
    })
    const { loaded, restore } = loadAdminService(fake)

    await expect(
      loaded.createUser({
        nom: 'Alice',
        nom_boutique: 'Atelier Alice',
        role: 'permanent',
      }),
    ).rejects.toMatchObject({
      name: 'AdminUserError',
      statusCode: 409,
      code: 'DUPLICATE_SHOP',
    })

    restore()
  })

  it('desactive, reactive et protege les cas interdits', async () => {
    const fake = createFakeSupabase({
      users: [
        { id: 1, nom: 'Admin', nom_boutique: 'Admin', role: 'admin', est_actif: true },
        {
          id: 2,
          nom: 'Alice',
          nom_boutique: 'Atelier Alice',
          role: 'permanent',
          est_actif: true,
        },
        { id: 3, nom: 'Bob', nom_boutique: 'Atelier Bob', role: 'permanent', est_actif: false },
      ],
    })
    const { loaded, restore } = loadAdminService(fake)

    await expect(loaded.deactivateUser(2, 2)).rejects.toMatchObject({ code: 'SELF_DELETE' })
    await expect(loaded.deactivateUser(1, 99)).rejects.toMatchObject({
      code: 'ADMIN_DEACTIVATE',
    })

    await expect(loaded.deactivateUser(2, 99)).resolves.toMatchObject({
      id: 2,
      est_actif: false,
    })
    await expect(loaded.reactivateUser(3)).resolves.toMatchObject({
      id: 3,
      est_actif: true,
    })
    await expect(loaded.reactivateUser(999)).rejects.toMatchObject({ code: 'USER_NOT_FOUND' })

    restore()
  })

  it('met a jour, retire et valide les commissions personnalisees', async () => {
    const fake = createFakeSupabase({
      users: [
        {
          id: 1,
          nom: 'Admin',
          nom_boutique: 'Admin',
          role: 'admin',
          commission_cb_personnalisee: null,
        },
        {
          id: 2,
          nom: 'Alice',
          nom_boutique: 'Atelier Alice',
          role: 'permanent',
          commission_cb_personnalisee: null,
        },
      ],
    })
    const { loaded, restore } = loadAdminService(fake)

    await expect(loaded.updateUserCommission(2, '2,50')).resolves.toMatchObject({
      previousUser: expect.objectContaining({ commission_cb_personnalisee: null }),
      user: expect.objectContaining({ commission_cb_personnalisee: 2.5 }),
    })
    await expect(loaded.updateUserCommission(2, '')).resolves.toMatchObject({
      user: expect.objectContaining({ commission_cb_personnalisee: null }),
    })
    await expect(loaded.updateUserCommission(2, '-1')).rejects.toMatchObject({
      code: 'INVALID_COMMISSION',
    })
    await expect(loaded.updateUserCommission(1, '1')).rejects.toMatchObject({
      code: 'ADMIN_COMMISSION',
    })

    restore()
  })

  it('reinitialise le mot de passe avec un mot de passe genere', async () => {
    const resetUserPassword = vi.fn(async (_userId, password) => password)
    const fake = createFakeSupabase({
      users: [{ id: 2, nom: 'Alice', nom_boutique: 'Atelier Alice', role: 'permanent' }],
    })
    const { loaded, restore } = loadAdminService(fake, { resetUserPassword })

    const result = await loaded.resetPasswordForUser(2)

    expect(resetUserPassword).toHaveBeenCalledWith(2, 'atelieralice0042')
    expect(result).toEqual({
      user: { id: 2, nom: 'Alice', nom_boutique: 'Atelier Alice', role: 'permanent' },
      newPassword: 'atelieralice0042',
    })

    restore()
  })

  it('prolonge uniquement les utilisateurs temporaires avec une date posterieure', async () => {
    const extendUserDateFin = vi.fn(async () => true)
    const fake = createFakeSupabase({
      users: [
        { id: 2, nom: 'Alice', role: 'permanent', date_fin: null },
        { id: 3, nom: 'Temp', role: 'temporaire', date_fin: '2026-07-31' },
      ],
    })
    const { loaded, restore } = loadAdminService(fake, { extendUserDateFin })

    await expect(loaded.extendTemporaryUserAccess(3, '')).rejects.toMatchObject({
      code: 'MISSING_END_DATE',
    })
    await expect(loaded.extendTemporaryUserAccess(2, '2026-08-31')).rejects.toMatchObject({
      code: 'NOT_TEMPORARY',
    })
    await expect(loaded.extendTemporaryUserAccess(3, '2026-07-15')).rejects.toMatchObject({
      code: 'END_DATE_NOT_AFTER_CURRENT',
    })
    await expect(loaded.extendTemporaryUserAccess(3, '2026-08-31')).resolves.toMatchObject({
      user: expect.objectContaining({ id: 3 }),
      nouvelleDateFin: '2026-08-31',
    })
    expect(extendUserDateFin).toHaveBeenCalledWith(3, '2026-08-31')

    restore()
  })
})
