import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { invokeRoute } from '../../helpers/routeTestUtils'
import { artisanUser, loadRapportsController } from './controllerTestUtils'

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

    await expect(invokeRoute(router, 'get', '/')).resolves.toMatchObject({
      res: { statusCode: 200, body: { global: true } },
    })
    await expect(invokeRoute(router, 'get', '/mensuel')).resolves.toMatchObject({
      res: { statusCode: 200, body: { mensuel: true } },
    })
    await expect(
      invokeRoute(router, 'get', '/artisans', { query: { include_inactive: 'true' } }),
    ).resolves.toMatchObject({
      res: { statusCode: 200, body: [artisanUser] },
    })
    expect(models.getAllArtisans).toHaveBeenCalledWith({ includeInactive: true })

    await expect(
      invokeRoute(router, 'get', '/mensuel/:mois', { params: { mois: '2026-07' } }),
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
    await expect(invokeRoute(router, 'get', '/')).resolves.toMatchObject({
      res: { statusCode: 500, body: { error: 'Erreur serveur' } },
    })
    expect(logger.logError).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'rapports.list', cible_type: 'rapport' }),
    )

    rapportService.getRapportMensuel.mockRejectedValueOnce(new Error('mensuel failed'))
    await expect(invokeRoute(router, 'get', '/mensuel')).resolves.toMatchObject({
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
