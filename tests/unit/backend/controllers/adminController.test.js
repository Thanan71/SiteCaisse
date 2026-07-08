import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { invokeRoute } from '../../helpers/routeTestUtils'
import { AdminUserError, adminUser, artisanUser, loadAdminController } from './controllerTestUtils'

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('adminController', () => {
  it('refuse les non-admin et liste les utilisateurs pour un admin', async () => {
    const { router, adminService, restore } = loadAdminController()

    await expect(
      invokeRoute(router, 'get', '/users', {
        user: { ...artisanUser },
      }),
    ).resolves.toMatchObject({
      res: { statusCode: 403, body: { error: 'Accès réservé aux administrateurs' } },
    })
    expect(adminService.listUsers).not.toHaveBeenCalled()

    await expect(invokeRoute(router, 'get', '/users')).resolves.toMatchObject({
      res: { statusCode: 200, body: [adminUser] },
    })
    expect(adminService.listUsers).toHaveBeenCalledTimes(1)

    restore()
  })

  it('cree un utilisateur et valide les champs obligatoires', async () => {
    const { router, adminService, logger, restore } = loadAdminController()

    await expect(invokeRoute(router, 'post', '/users', { body: {} })).resolves.toMatchObject({
      res: { statusCode: 400, body: { error: 'Nom, nom de boutique et rôle requis' } },
    })

    await expect(
      invokeRoute(router, 'post', '/users', {
        body: { nom: 'Zoe', nom_boutique: 'Atelier Zoe', role: 'admin' },
      }),
    ).resolves.toMatchObject({
      res: { statusCode: 400, body: { error: 'Le rôle doit être "permanent" ou "temporaire"' } },
    })

    await expect(
      invokeRoute(router, 'post', '/users', {
        body: { nom: 'Zoe', nom_boutique: 'Atelier Zoe', role: 'temporaire' },
      }),
    ).resolves.toMatchObject({
      res: {
        statusCode: 400,
        body: { error: 'Une date de fin est requise pour les utilisateurs temporaires' },
      },
    })

    await expect(
      invokeRoute(router, 'post', '/users', {
        body: {
          date_fin: '2026-08-31',
          nom: 'Zoe',
          nom_boutique: 'Atelier Zoe',
          role: 'permanent',
        },
      }),
    ).resolves.toMatchObject({
      res: {
        statusCode: 400,
        body: { error: 'Un utilisateur permanent ne peut pas avoir de date de fin' },
      },
    })

    await expect(
      invokeRoute(router, 'post', '/users', {
        body: { nom: 'Zoe', nom_boutique: 'Atelier Zoe', role: 'permanent' },
      }),
    ).resolves.toMatchObject({
      res: {
        statusCode: 201,
        body: {
          message: 'Utilisateur créé avec succès.',
          newPassword: 'atelier1234',
          user: expect.objectContaining({ id: 3 }),
        },
      },
    })
    expect(adminService.createUser).toHaveBeenCalledWith({
      date_fin: undefined,
      nom: 'Zoe',
      nom_boutique: 'Atelier Zoe',
      role: 'permanent',
    })
    expect(logger.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user.create', cible_id: 3 }),
    )

    restore()
  })

  it('traduit les erreurs metier admin en reponses HTTP', async () => {
    const { router, adminService, restore } = loadAdminController({
      createUser: vi.fn(async () => {
        throw new AdminUserError('Boutique deja utilisee', 409)
      }),
    })

    await expect(
      invokeRoute(router, 'post', '/users', {
        body: { nom: 'Zoe', nom_boutique: 'Atelier Zoe', role: 'permanent' },
      }),
    ).resolves.toMatchObject({
      res: { statusCode: 409, body: { error: 'Boutique deja utilisee' } },
    })
    expect(adminService.createUser).toHaveBeenCalled()

    restore()
  })

  it('archive, reactive, modifie la commission, reset et prolonge un utilisateur', async () => {
    const { router, adminService, logger, restore } = loadAdminController()

    await expect(
      invokeRoute(router, 'delete', '/users/:id', { params: { id: '3' } }),
    ).resolves.toMatchObject({
      res: { statusCode: 200, body: { message: 'Utilisateur désactivé avec succès' } },
    })
    expect(adminService.deactivateUser).toHaveBeenCalledWith(3, adminUser.id)

    await expect(
      invokeRoute(router, 'patch', '/users/:id/reactivate', { params: { id: '3' } }),
    ).resolves.toMatchObject({
      res: {
        statusCode: 200,
        body: {
          message: 'Utilisateur désarchivé avec succès',
          user: expect.objectContaining({ id: 3 }),
        },
      },
    })

    await expect(
      invokeRoute(router, 'patch', '/users/:id/commission', {
        body: { commission_cb_personnalisee: '1.5' },
        params: { id: '3' },
      }),
    ).resolves.toMatchObject({
      res: {
        statusCode: 200,
        body: {
          message: 'Commission personnalisée mise à jour avec succès',
          user: expect.objectContaining({ commission_cb_personnalisee: 1.5 }),
        },
      },
    })
    expect(adminService.updateUserCommission).toHaveBeenCalledWith(3, '1.5')

    await expect(
      invokeRoute(router, 'post', '/users/:id/reset-password', { params: { id: '3' } }),
    ).resolves.toMatchObject({
      res: {
        statusCode: 200,
        body: { message: 'Mot de passe réinitialisé avec succès.', newPassword: 'reset1234' },
      },
    })

    await expect(
      invokeRoute(router, 'patch', '/users/:id/extend', {
        body: { date_fin: '2026-08-31' },
        params: { id: '4' },
      }),
    ).resolves.toMatchObject({
      res: {
        statusCode: 200,
        body: { message: 'Accès prolongé avec succès', nouvelle_date_fin: '2026-08-31' },
      },
    })
    expect(logger.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user.extend', cible_id: 4 }),
    )

    restore()
  })

  it('gere les parametres et les logs avec validation des valeurs', async () => {
    const { router, parametres, logger, restore } = loadAdminController()

    await expect(invokeRoute(router, 'get', '/parametres')).resolves.toMatchObject({
      res: { statusCode: 200, body: { commission_cb_permanent: '1.5' } },
    })

    await expect(
      invokeRoute(router, 'put', '/parametres/:cle', {
        body: { valeur: '' },
        params: { cle: 'commission_cb_permanent' },
      }),
    ).resolves.toMatchObject({
      res: { statusCode: 400, body: { error: 'La valeur est requise' } },
    })

    await expect(
      invokeRoute(router, 'put', '/parametres/:cle', {
        body: { valeur: '-1' },
        params: { cle: 'commission_cb_permanent' },
      }),
    ).resolves.toMatchObject({
      res: { statusCode: 400, body: { error: 'La valeur doit être un nombre positif' } },
    })

    await expect(
      invokeRoute(router, 'put', '/parametres/:cle', {
        body: { valeur: '2.25' },
        params: { cle: 'commission_cb_permanent' },
      }),
    ).resolves.toMatchObject({
      res: { statusCode: 200, body: { message: 'Paramètre mis à jour avec succès' } },
    })
    expect(parametres.updateParametre).toHaveBeenCalledWith('commission_cb_permanent', '2.25')

    logger.getActionLogs.mockResolvedValueOnce({ logs: [{ id: 1 }], pagination: { page: 1 } })
    await expect(
      invokeRoute(router, 'get', '/logs', {
        query: { action: 'vente.create', cible_type: 'vente', limit: '5', page: '2' },
      }),
    ).resolves.toMatchObject({
      res: { statusCode: 200, body: { logs: [{ id: 1 }], pagination: { page: 1 } } },
    })
    expect(logger.getActionLogs).toHaveBeenCalledWith({
      action: 'vente.create',
      cible_type: 'vente',
      limit: '5',
      page: '2',
    })

    restore()
  })
})
