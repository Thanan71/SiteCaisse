import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadCjsWithMocks } from '../../helpers/loadCjsWithMocks'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('rapportService', () => {
  function loadRapportService(models, parametres = {}) {
    return loadCjsWithMocks('api/services/rapportService.cjs', {
      'api/models.cjs': models,
      'api/services/parametresService.cjs': {
        getAllParametres: vi.fn(async () => ({
          commission_cb_permanent: '1.5',
          commission_cb_temporaire: '2.5',
          ...parametres,
        })),
      },
    })
  }

  const groupedData = {
    groupes: [
      {
        artisan_id: 1,
        artisan_role: 'permanent',
        ventes: [
          { type_paiement: 'CB', articles: [{ prix: 100, quantite: 1 }] },
          { type_paiement: 'Espece', articles: [{ prix: 50, quantite: 1 }] },
          { type_paiement: 'Cheque', articles: [{ prix: 50, quantite: 1 }] },
        ],
        summary: { total_articles: 3, total_montant: 200 },
      },
      {
        artisan_id: 2,
        artisan_role: 'temporaire',
        ventes: [
          { type_paiement: 'CB', articles: [{ prix: 50, quantite: 2 }] },
          { type_paiement: 'Espece', articles: [{ prix: 50, quantite: 1 }] },
          { type_paiement: 'Cheque', articles: [{ prix: 50, quantite: 1 }] },
        ],
        summary: { total_articles: 4, total_montant: 200 },
      },
    ],
    total: { total_articles: 7, total_montant: 400 },
  }

  it('enrichit le rapport global avec les commissions', async () => {
    const { loaded, restore } = loadRapportService({
      getAllVentesGroupedByArtisan: vi.fn(async () => groupedData),
    })

    const result = await loaded.getRapportGlobal()

    expect(result.total).toEqual({
      total_articles: 7,
      total_montant: 400,
      total_cb: 200,
      total_commission: 6.5,
    })
    expect(result.groupes[0].summary.commission_cb).toBe(1.5)
    expect(result.groupes[1].summary.commission_cb).toBe(5)
    expect(result.groupes[1].summary.assiette_commission).toBe('tous_paiements')
    expect(result.parametres).toEqual({
      commission_cb_permanent: 1.5,
      commission_cb_temporaire: 2.5,
    })

    restore()
  })

  it('enrichit les rapports mensuels et par mois', async () => {
    const models = {
      getAllVentesGroupedByMonth: vi.fn(async () => ({
        mois: [{ mois: '2026-07', ...groupedData }],
        total: groupedData.total,
      })),
      getVentesByMonth: vi.fn(async () => groupedData),
    }
    const { loaded, restore } = loadRapportService(models)

    const mensuel = await loaded.getRapportMensuel()
    const juillet = await loaded.getRapportParMois('2026-07')

    expect(mensuel.mois[0].total).toMatchObject({
      total_cb: 200,
      total_commission: 6.5,
    })
    expect(juillet.total).toMatchObject({
      total_cb: 200,
      total_commission: 6.5,
    })
    expect(models.getVentesByMonth).toHaveBeenCalledWith('2026-07')

    restore()
  })

  it('applique la commission personnalisee sur un rapport artisan', async () => {
    const { loaded, restore } = loadRapportService({
      getVentesByArtisan: vi.fn(async () => ({
        ventes: groupedData.groupes[1].ventes,
        summary: groupedData.groupes[1].summary,
      })),
      getAllArtisans: vi.fn(async () => [
        {
          id: 2,
          role: 'temporaire',
          commission_cb_personnalisee: 3,
        },
      ]),
    })

    const result = await loaded.getRapportArtisan(2)

    expect(result.summary).toMatchObject({
      total_cb: 100,
      commission_cb: 6,
      taux_commission: 3,
      commission_personnalisee: true,
      assiette_commission: 'tous_paiements',
    })

    restore()
  })
})
