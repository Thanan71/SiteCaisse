import crypto from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase } from '../../helpers/fakeSupabase'
import { loadCjsWithMocks } from '../../helpers/loadCjsWithMocks'

const adminActor = { id: 99, role: 'admin' }
const devActor = { id: 100, role: 'dev' }

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

  it.each([
    adminActor,
    devActor,
  ])('exclut tous les comptes dev de la liste pour $role sans modifier les comptes stockes', async (actor) => {
    const users = [
      { id: 1, role: 'dev', est_actif: true, generated_password: 'secret-dev' },
      { id: 2, role: 'permanent', generated_password: 'artisan-password' },
      { id: 3, role: 'admin', generated_password: 'admin-password' },
      { id: 4, role: 'temporaire', generated_password: 'invite-password' },
      { id: 5, role: 'dev', est_actif: false, generated_password: 'secret-dev-inactif' },
    ]
    const fake = createFakeSupabase({ users })
    const { loaded, restore } = loadAdminService(fake)

    expect(await loaded.listUsers(actor)).toEqual(users.slice(1, 4))
    expect(fake.tables.users).toEqual(users)
    restore()
  })

  it.each(['admin', 'dev'])('reserve la creation du role %s aux dev', async (role) => {
    const fake = createFakeSupabase({ users: [] })
    const { loaded, restore } = loadAdminService(fake)
    const payload = { nom: 'Equipe', nom_boutique: `Compte ${role}`, role }

    await expect(loaded.createUser(payload, adminActor)).rejects.toMatchObject({
      statusCode: 403,
      code: 'PRIVILEGED_ROLE_FORBIDDEN',
    })
    expect(fake.tables.users).toEqual([])

    const result = await loaded.createUser(payload, devActor)
    expect(result.user).toMatchObject({ role, password_change_required: true })
    expect(result.newPassword).toBe(`compte${role}0042`)
    restore()
  })

  it.each([
    ['archivage', (service, actor) => service.deactivateUser(1, actor)],
    ['reactivation', (service, actor) => service.reactivateUser(1, actor)],
    ['commission', (service, actor) => service.updateUserCommission(1, 2.5, actor)],
    ['mot de passe', (service, actor) => service.resetPasswordForUser(1, actor)],
    ['prolongation', (service, actor) => service.extendTemporaryUserAccess(1, '2099-12-31', actor)],
  ])('interdit aux admins la gestion des dev: %s', async (_name, action) => {
    const users = [{ id: 1, role: 'dev', est_actif: false, nom_boutique: 'Developpeur' }]
    const fake = createFakeSupabase({ users })
    const resetUserPassword = vi.fn()
    const extendUserDateFin = vi.fn()
    const { loaded, restore } = loadAdminService(fake, { resetUserPassword, extendUserDateFin })

    await expect(action(loaded, adminActor)).rejects.toMatchObject({
      statusCode: 403,
      code: 'DEV_ACCOUNT_FORBIDDEN',
    })
    expect(fake.tables.users).toEqual(users)
    expect(resetUserPassword).not.toHaveBeenCalled()
    expect(extendUserDateFin).not.toHaveBeenCalled()
    restore()
  })

  it('autorise un dev a reactiver et reinitialiser un dev, et conserve les protections admin', async () => {
    const fake = createFakeSupabase({
      users: [{ id: 1, role: 'dev', est_actif: false, nom_boutique: 'Developpeur' }],
    })
    const resetUserPassword = vi.fn(async (_id, password) => password)
    const { loaded, restore } = loadAdminService(fake, { resetUserPassword })

    await expect(loaded.reactivateUser(1, devActor)).resolves.toMatchObject({ est_actif: true })
    await expect(loaded.resetPasswordForUser(1, devActor)).resolves.toMatchObject({
      newPassword: 'developpeur0042',
    })
    await expect(loaded.deactivateUser(1, devActor)).rejects.toMatchObject({
      code: 'ADMIN_DEACTIVATE',
    })
    await expect(loaded.deactivateUser(100, devActor)).rejects.toMatchObject({
      code: 'SELF_DELETE',
    })
    await expect(loaded.updateUserCommission(1, 2.5, devActor)).rejects.toMatchObject({
      code: 'ADMIN_COMMISSION',
    })
    restore()
  })

  it.each([
    undefined,
    'permanent',
    'temporaire',
  ])('refuse les services sans privilege admin: %s', async (role) => {
    const fake = createFakeSupabase({ users: [] })
    const { loaded, restore } = loadAdminService(fake)
    const actor = role ? { id: 1, role } : undefined
    const actions = [
      () => loaded.listUsers(actor),
      () => loaded.createUser({ nom: 'Test', nom_boutique: 'Test', role: 'permanent' }, actor),
      () => loaded.deactivateUser(2, actor),
      () => loaded.reactivateUser(2, actor),
      () => loaded.updateUserCommission(2, 3, actor),
      () => loaded.resetPasswordForUser(2, actor),
      () => loaded.extendTemporaryUserAccess(2, '2099-12-31', actor),
    ]
    for (const action of actions) {
      await expect(action()).rejects.toMatchObject({ statusCode: 403, code: 'ADMIN_REQUIRED' })
    }
    expect(fake.tables.users).toEqual([])
    restore()
  })

  it('cree un utilisateur avec mot de passe normalise et changement obligatoire', async () => {
    const fake = createFakeSupabase({ users: [] })
    const { loaded, restore } = loadAdminService(fake)

    const result = await loaded.createUser(
      {
        nom: 'Zoe',
        nom_boutique: 'Atelier Zoé !',
        role: 'temporaire',
        date_fin: '2026-08-01',
      },
      adminActor,
    )

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
      loaded.createUser(
        { nom: 'Alice', nom_boutique: 'Atelier Alice', role: 'permanent' },
        adminActor,
      ),
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

    await expect(loaded.deactivateUser(2, { ...adminActor, id: 2 })).rejects.toMatchObject({
      code: 'SELF_DELETE',
    })
    await expect(loaded.deactivateUser(1, adminActor)).rejects.toMatchObject({
      code: 'ADMIN_DEACTIVATE',
    })

    await expect(loaded.deactivateUser(2, adminActor)).resolves.toMatchObject({
      id: 2,
      est_actif: false,
    })
    await expect(loaded.reactivateUser(3, adminActor)).resolves.toMatchObject({
      id: 3,
      est_actif: true,
    })
    await expect(loaded.reactivateUser(999, adminActor)).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    })

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

    await expect(loaded.updateUserCommission(2, '2,50', adminActor)).resolves.toMatchObject({
      previousUser: expect.objectContaining({ commission_cb_personnalisee: null }),
      user: expect.objectContaining({ commission_cb_personnalisee: 2.5 }),
    })
    await expect(loaded.updateUserCommission(2, '', adminActor)).resolves.toMatchObject({
      user: expect.objectContaining({ commission_cb_personnalisee: null }),
    })
    await expect(loaded.updateUserCommission(2, '-1', adminActor)).rejects.toMatchObject({
      code: 'INVALID_COMMISSION',
    })
    await expect(loaded.updateUserCommission(1, '1', adminActor)).rejects.toMatchObject({
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

    const result = await loaded.resetPasswordForUser(2, adminActor)

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

    await expect(loaded.extendTemporaryUserAccess(3, '', adminActor)).rejects.toMatchObject({
      code: 'MISSING_END_DATE',
    })
    await expect(
      loaded.extendTemporaryUserAccess(2, '2026-08-31', adminActor),
    ).rejects.toMatchObject({
      code: 'NOT_TEMPORARY',
    })
    await expect(
      loaded.extendTemporaryUserAccess(3, '2026-07-15', adminActor),
    ).rejects.toMatchObject({
      code: 'END_DATE_NOT_AFTER_CURRENT',
    })
    await expect(
      loaded.extendTemporaryUserAccess(3, '2026-08-31', adminActor),
    ).resolves.toMatchObject({
      user: expect.objectContaining({ id: 3 }),
      nouvelleDateFin: '2026-08-31',
    })
    expect(extendUserDateFin).toHaveBeenCalledWith(3, '2026-08-31')

    restore()
  })
})
