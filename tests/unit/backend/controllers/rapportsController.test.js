import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { invokeRoute } from '../../helpers/routeTestUtils'
import { adminUser, artisanUser, loadRapportsController } from './controllerTestUtils'

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('rapportsController', () => {
  it('retourne les rapports globaux, mensuels, artisans et par artisan', async () => {
    const { router, models, rapportService, restore } = loadRapportsController({
      getRapportArtisan: vi.fn(async () => ({ artisan: 2 })),
      getRapportGlobal: vi.fn(async () => ({ global: true })),
      getRapportMensuel: vi.fn(async () => ({ mensuel: true })),
      getRapportParMois: vi.fn(async () => ({ mois: '2026-07' })),
    })

    await expect(invokeRoute(router, 'get', '/', { user: adminUser })).resolves.toMatchObject({
      res: { statusCode: 200, body: { global: true } },
    })
    await expect(
      invokeRoute(router, 'get', '/mensuel', { user: adminUser }),
    ).resolves.toMatchObject({
      res: { statusCode: 200, body: { mensuel: true } },
    })
    await expect(
      invokeRoute(router, 'get', '/artisans', {
        query: { include_inactive: 'true' },
        user: adminUser,
      }),
    ).resolves.toMatchObject({
      res: { statusCode: 200, body: [artisanUser] },
    })
    expect(models.getAllArtisans).toHaveBeenCalledWith({ includeInactive: true })

    await expect(
      invokeRoute(router, 'get', '/mensuel/:mois', {
        params: { mois: '2026-07' },
        user: adminUser,
      }),
    ).resolves.toMatchObject({
      res: { statusCode: 200, body: { mois: '2026-07' } },
    })
    expect(rapportService.getRapportParMois).toHaveBeenCalledWith('2026-07')

    await expect(
      invokeRoute(router, 'get', '/:artisan_id', { params: { artisan_id: '2' } }),
    ).resolves.toMatchObject({
      res: { statusCode: 200, body: { artisan: 2 } },
    })
    expect(rapportService.getRapportArtisan).toHaveBeenCalledWith(2)

    restore()
  })

  it('limite un artisan a ses propres rapports', async () => {
    const autreArtisan = {
      id: 3,
      nom: 'Bruno',
      nom_boutique: 'Boutique Bruno',
      role: 'temporaire',
    }
    const ownGroup = {
      artisan_id: artisanUser.id,
      summary: { total_articles: 2, total_montant: 30, total_cb: 20, total_commission: 1 },
      ventes: [{ id: 10 }],
    }
    const otherGroup = {
      artisan_id: autreArtisan.id,
      summary: { total_articles: 4, total_montant: 80, total_cb: 50, total_commission: 2 },
      ventes: [{ id: 11 }],
    }

    const { router, models, rapportService, restore } = loadRapportsController(
      {
        getRapportParMois: vi.fn(async () => ({
          groupes: [ownGroup, otherGroup],
          total: { total_articles: 6, total_montant: 110 },
          parametres: { commission_cb_permanent: 1.5, commission_cb_temporaire: 2.5 },
        })),
      },
      {
        getAllArtisans: vi.fn(async () => [artisanUser, autreArtisan]),
      },
    )

    await expect(invokeRoute(router, 'get', '/')).resolves.toMatchObject({
      res: { statusCode: 403, body: { error: 'Accès réservé aux administrateurs' } },
    })
    expect(rapportService.getRapportGlobal).not.toHaveBeenCalled()

    await expect(invokeRoute(router, 'get', '/mensuel')).resolves.toMatchObject({
      res: { statusCode: 403, body: { error: 'Accès réservé aux administrateurs' } },
    })
    expect(rapportService.getRapportMensuel).not.toHaveBeenCalled()

    await expect(
      invokeRoute(router, 'get', '/:artisan_id', { params: { artisan_id: '3' } }),
    ).resolves.toMatchObject({
      res: {
        statusCode: 403,
        body: { error: 'Vous ne pouvez consulter que votre propre rapport' },
      },
    })
    expect(rapportService.getRapportArtisan).not.toHaveBeenCalled()

    const ownArtisans = await invokeRoute(router, 'get', '/artisans', {
      query: { include_inactive: 'true' },
    })
    expect(ownArtisans.res.body).toEqual([artisanUser])
    expect(models.getAllArtisans).toHaveBeenCalledWith({ includeInactive: true })

    const ownMonth = await invokeRoute(router, 'get', '/mensuel/:mois', {
      params: { mois: '2026-07' },
    })
    expect(ownMonth.res.body.groupes).toEqual([ownGroup])
    expect(ownMonth.res.body.total).toEqual(ownGroup.summary)

    await expect(
      invokeRoute(router, 'get', '/:artisan_id', {
        params: { artisan_id: String(artisanUser.id) },
      }),
    ).resolves.toMatchObject({ res: { statusCode: 200 } })
    expect(rapportService.getRapportArtisan).toHaveBeenCalledWith(artisanUser.id)

    restore()
  })

  it('valide les parametres et journalise les erreurs serveur', async () => {
    const { router, models, rapportService, logger, restore } = loadRapportsController()

    await expect(
      invokeRoute(router, 'get', '/mensuel/:mois', { params: { mois: 'juillet' } }),
    ).resolves.toMatchObject({
      res: { statusCode: 400, body: { error: 'Format de mois invalide. Utilisez YYYY-MM' } },
    })

    await expect(
      invokeRoute(router, 'get', '/:artisan_id', { params: { artisan_id: 'abc' } }),
    ).resolves.toMatchObject({
      res: { statusCode: 400, body: { error: 'ID artisan invalide' } },
    })

    rapportService.getRapportGlobal.mockRejectedValueOnce(new Error('boom'))
    await expect(invokeRoute(router, 'get', '/', { user: adminUser })).resolves.toMatchObject({
      res: { statusCode: 500, body: { error: 'Erreur serveur' } },
    })
    expect(logger.logError).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'rapports.list', cible_type: 'rapport' }),
    )

    rapportService.getRapportMensuel.mockRejectedValueOnce(new Error('mensuel failed'))
    await expect(
      invokeRoute(router, 'get', '/mensuel', { user: adminUser }),
    ).resolves.toMatchObject({
      res: { statusCode: 500, body: { error: 'Erreur serveur' } },
    })
    expect(logger.logError).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'rapports.mensuel', cible_type: 'rapport' }),
    )

    models.getAllArtisans.mockRejectedValueOnce(new Error('artisans failed'))
    await expect(invokeRoute(router, 'get', '/artisans')).resolves.toMatchObject({
      res: { statusCode: 500, body: { error: 'Erreur serveur' } },
    })
    expect(logger.logError).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'rapports.artisans', cible_type: 'rapport' }),
    )

    rapportService.getRapportParMois.mockRejectedValueOnce(new Error('mois failed'))
    await expect(
      invokeRoute(router, 'get', '/mensuel/:mois', { params: { mois: '2026-07' } }),
    ).resolves.toMatchObject({
      res: { statusCode: 500, body: { error: 'Erreur serveur' } },
    })
    expect(logger.logError).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'rapports.mensuel.mois', cible_type: 'rapport' }),
    )

    rapportService.getRapportArtisan.mockRejectedValueOnce(new Error('artisan failed'))
    await expect(
      invokeRoute(router, 'get', '/:artisan_id', { params: { artisan_id: '2' } }),
    ).resolves.toMatchObject({
      res: { statusCode: 500, body: { error: 'Erreur serveur' } },
    })
    expect(logger.logError).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'rapports.artisan',
        cible_type: 'rapport',
        cible_id: '2',
      }),
    )

    restore()
  })
})
