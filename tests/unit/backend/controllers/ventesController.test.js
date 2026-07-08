import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { invokeRoute } from '../../helpers/routeTestUtils'
import { artisanUser, loadVentesController } from './controllerTestUtils'

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ventesController', () => {
  it('liste, cree, modifie et supprime des ventes authentifiees', async () => {
    const { router, models, logger, restore } = loadVentesController({
      getAllVentes: vi.fn(async () => ({ ventes: [{ id: 10 }], pagination: { page: 2 } })),
    })

    await expect(
      invokeRoute(router, 'get', '/', {
        query: { page: '2', limit: '20', type_paiement: 'CB' },
      }),
    ).resolves.toMatchObject({
      res: { statusCode: 200, body: { ventes: [{ id: 10 }], pagination: { page: 2 } } },
    })
    expect(models.getAllVentes).toHaveBeenCalledWith({
      date_debut: undefined,
      date_fin: undefined,
      limit: 20,
      page: 2,
      type_paiement: 'CB',
    })

    const ventePayload = {
      articles: [{ article: 'Bol', quantite: 2, prix: 12, artisan_id: 3 }],
      date_vente: '2026-07-08',
      type_paiement: 'CB',
    }
    await expect(
      invokeRoute(router, 'post', '/', {
        body: ventePayload,
      }),
    ).resolves.toMatchObject({
      res: { statusCode: 201, body: { id: 42, message: 'Vente créée avec succès' } },
    })
    expect(models.createVente).toHaveBeenCalledWith(
      ventePayload.articles,
      'CB',
      artisanUser.id,
      '2026-07-08',
    )
    expect(logger.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'vente.create', cible_id: 42 }),
    )

    await expect(
      invokeRoute(router, 'put', '/:id', {
        body: { type_paiement: 'Cheque' },
        params: { id: '42' },
      }),
    ).resolves.toMatchObject({
      res: { statusCode: 200, body: { message: 'Vente modifiée avec succès' } },
    })

    await expect(
      invokeRoute(router, 'delete', '/:id', {
        params: { id: '42' },
      }),
    ).resolves.toMatchObject({
      res: { statusCode: 200, body: { message: 'Vente supprimée avec succès' } },
    })

    restore()
  })

  it('retourne les erreurs de validation, not found et serveur', async () => {
    const { router, models, logger, restore } = loadVentesController()

    await expect(
      invokeRoute(router, 'post', '/', {
        body: { articles: [], date_vente: '2026-07-08', type_paiement: 'CB' },
      }),
    ).resolves.toMatchObject({
      res: { statusCode: 400 },
    })

    await expect(
      invokeRoute(router, 'put', '/:id', {
        body: { type_paiement: 'CB' },
        params: { id: 'abc' },
      }),
    ).resolves.toMatchObject({
      res: { statusCode: 400, body: { error: 'ID vente invalide' } },
    })

    models.updateVente.mockResolvedValueOnce(false)
    await expect(
      invokeRoute(router, 'put', '/:id', {
        body: { type_paiement: 'CB' },
        params: { id: '404' },
      }),
    ).resolves.toMatchObject({
      res: { statusCode: 404, body: { error: 'Vente non trouvée ou aucune modification' } },
    })

    models.getAllVentes.mockRejectedValueOnce(new Error('boom'))
    await expect(invokeRoute(router, 'get', '/')).resolves.toMatchObject({
      res: { statusCode: 500, body: { error: 'Erreur serveur' } },
    })
    expect(logger.logError).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'ventes.list', cible_type: 'vente' }),
    )

    restore()
  })
})
