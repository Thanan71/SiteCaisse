import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { invokeRoute } from '../../helpers/routeTestUtils'
import { JWT_SECRET, loadAuthController } from './controllerTestUtils'

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('authController', () => {
  it('connecte un utilisateur actif et journalise la connexion', async () => {
    const user = {
      id: 2,
      nom: 'Alice',
      nom_boutique: 'Atelier Alice',
      password_hash: bcrypt.hashSync('secret', 10),
      password_change_required: true,
      role: 'permanent',
      est_actif: true,
    }
    const { router, models, logger, restore } = loadAuthController({
      findUserByNomBoutique: vi.fn(async () => user),
    })

    const { res } = await invokeRoute(router, 'post', '/login', {
      body: { nom_boutique: 'Atelier Alice', password: 'secret' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      token: expect.any(String),
      password_change_required: true,
      user: {
        id: 2,
        nom: 'Alice',
        nom_boutique: 'Atelier Alice',
        role: 'permanent',
        password_change_required: true,
      },
    })
    expect(models.findUserByNomBoutique).toHaveBeenCalledWith('Atelier Alice')
    expect(logger.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.login_success',
        cible_id: 2,
      }),
    )

    restore()
  })

  it('refuse les connexions incompletes, inconnues, inactives ou expirees', async () => {
    const inactiveUser = {
      id: 3,
      nom: 'Bob',
      nom_boutique: 'Boutique Bob',
      role: 'permanent',
      est_actif: false,
    }
    const expiredUser = {
      ...inactiveUser,
      id: 4,
      role: 'temporaire',
      est_actif: true,
      date_fin: '2000-01-01',
    }
    const { router, models, restore } = loadAuthController()

    await expect(invokeRoute(router, 'post', '/login', { body: {} })).resolves.toMatchObject({
      res: { statusCode: 400, body: { error: 'Nom de boutique et mot de passe requis' } },
    })

    models.findUserByNomBoutique.mockResolvedValueOnce(null)
    await expect(
      invokeRoute(router, 'post', '/login', {
        body: { nom_boutique: 'Inconnu', password: 'secret' },
      }),
    ).resolves.toMatchObject({
      res: { statusCode: 401, body: { error: 'Nom de boutique ou mot de passe incorrect' } },
    })

    models.findUserByNomBoutique.mockResolvedValueOnce(inactiveUser)
    await expect(
      invokeRoute(router, 'post', '/login', {
        body: { nom_boutique: 'Boutique Bob', password: 'secret' },
      }),
    ).resolves.toMatchObject({
      res: { statusCode: 403, body: { error: 'Compte désactivé' } },
    })

    models.findUserByNomBoutique.mockResolvedValueOnce(expiredUser)
    await expect(
      invokeRoute(router, 'post', '/login', {
        body: { nom_boutique: 'Boutique Bob', password: 'secret' },
      }),
    ).resolves.toMatchObject({
      res: {
        statusCode: 403,
        body: { error: 'Votre accès a expiré. Contactez un administrateur.' },
      },
    })

    restore()
  })

  it('verifie le token, retourne le profil et change un mot de passe valide', async () => {
    const passwordHash = bcrypt.hashSync('ancien', 10)
    const user = {
      id: 2,
      nom: 'Alice',
      nom_boutique: 'Atelier Alice',
      role: 'permanent',
      est_actif: true,
      password_hash: passwordHash,
      password_change_required: false,
    }
    const token = jwt.sign({ id: 2 }, JWT_SECRET)
    const { router, models, logger, restore } = loadAuthController({
      findUserById: vi.fn(async () => user),
    })

    await expect(
      invokeRoute(router, 'get', '/me', {
        headers: { authorization: `Bearer ${token}` },
      }),
    ).resolves.toMatchObject({
      res: { statusCode: 200, body: user },
    })

    const { res } = await invokeRoute(router, 'post', '/change-password', {
      body: { currentPassword: 'ancien', newPassword: 'nouveau' },
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ message: 'Mot de passe modifié avec succès' })
    expect(models.updatePassword).toHaveBeenCalledWith(2, 'nouveau')
    expect(logger.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.password_changed', cible_id: 2 }),
    )

    restore()
  })

  it('refuse un acces sans token', async () => {
    const { router, restore } = loadAuthController()

    await expect(invokeRoute(router, 'get', '/me')).resolves.toMatchObject({
      res: { statusCode: 401, body: { error: 'Token manquant' } },
    })

    restore()
  })
})
