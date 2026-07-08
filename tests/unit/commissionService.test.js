import { describe, expect, it } from 'vitest'
import commissionService from '../../api/services/commissionService.cjs'

const {
  ajouterCommissionAUnArtisan,
  ajouterCommissionsAuxGroupes,
  calculerCommissionsCB,
  getTauxCommission,
} = commissionService

describe('commissionService', () => {
  it('calcule uniquement les commissions des ventes CB', () => {
    const result = calculerCommissionsCB(
      [
        {
          type_paiement: 'CB',
          articles: [
            { prix: 10, quantite: 2 },
            { prix: 5, quantite: 1 },
          ],
        },
        { type_paiement: 'Espece', articles: [{ prix: 100, quantite: 1 }] },
        { type_paiement: 'CB', prix: 8, quantite: 2 },
      ],
      2.5,
    )

    expect(result).toEqual({ total_cb: 41, commission_cb: 1.03 })
  })

  it('priorise un taux personnalise quand il est present', () => {
    expect(getTauxCommission('temporaire', 1.5, 2.5, '0')).toEqual({
      taux: 0,
      personnalise: true,
    })
    expect(getTauxCommission('temporaire', 1.5, 2.5, '')).toEqual({
      taux: 2.5,
      personnalise: false,
    })
    expect(getTauxCommission('permanent', 1.5, 2.5, null)).toEqual({
      taux: 1.5,
      personnalise: false,
    })
  })

  it('ajoute les commissions aux groupes et cumule les totaux globaux', () => {
    const result = ajouterCommissionsAuxGroupes(
      [
        {
          artisan_role: 'permanent',
          ventes: [{ type_paiement: 'CB', articles: [{ prix: 100, quantite: 1 }] }],
          summary: { total_articles: 1, total_montant: 100 },
        },
        {
          artisan_role: 'temporaire',
          commission_cb_personnalisee: 3,
          ventes: [{ type_paiement: 'CB', articles: [{ prix: 50, quantite: 4 }] }],
          summary: { total_articles: 4, total_montant: 200 },
        },
      ],
      1.5,
      2.5,
    )

    expect(result.totalGlobalCB).toBe(300)
    expect(result.totalGlobalCommission).toBe(7.5)
    expect(result.groupesAvecCommissions[0].summary).toMatchObject({
      total_cb: 100,
      commission_cb: 1.5,
      taux_commission: 1.5,
      commission_personnalisee: false,
    })
    expect(result.groupesAvecCommissions[1].summary).toMatchObject({
      total_cb: 200,
      commission_cb: 6,
      taux_commission: 3,
      commission_personnalisee: true,
    })
  })

  it('ajoute la commission a un rapport artisan unique', () => {
    const result = ajouterCommissionAUnArtisan(
      {
        ventes: [
          { type_paiement: 'CB', articles: [{ prix: 80, quantite: 1 }] },
          { type_paiement: 'Cheque', articles: [{ prix: 20, quantite: 1 }] },
        ],
        summary: { total_articles: 2, total_montant: 100 },
      },
      'permanent',
      1.25,
      2.5,
    )

    expect(result.summary).toEqual({
      total_articles: 2,
      total_montant: 100,
      total_cb: 80,
      commission_cb: 1,
      taux_commission: 1.25,
      commission_personnalisee: false,
    })
  })
})
