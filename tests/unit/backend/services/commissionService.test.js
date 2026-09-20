import { describe, expect, it } from 'vitest'
import commissionService from '../../../../api/services/commissionService.cjs'
import aggregationService from '../../../../api/services/venteAggregationService.cjs'

const {
  ajouterCommissionAUnArtisan,
  ajouterCommissionsAuxGroupes,
  calculerCommissions,
  getTauxCommission,
} = commissionService

describe('commissionService', () => {
  describe.each(['permanent', 'temporaire'])('%s', (role) => {
    describe.each([
      { tauxPersonnalise: null, personnalise: false },
      { tauxPersonnalise: '3', personnalise: true },
      { tauxPersonnalise: '0', personnalise: true },
    ])('taux personnalisé $tauxPersonnalise', ({ tauxPersonnalise, personnalise }) => {
      it.each(['CB', 'Espece', 'Cheque'])('applique la bonne assiette pour %s', (typePaiement) => {
        const data = {
          ventes: [{ type_paiement: typePaiement, articles: [{ prix: 50, quantite: 2 }] }],
          summary: { total_articles: 2, total_montant: 100 },
        }
        const taux = personnalise ? Number(tauxPersonnalise) : role === 'temporaire' ? 2.5 : 1.5
        const attendu = {
          ...data.summary,
          total_cb: typePaiement === 'CB' ? 100 : 0,
          commission_cb: role === 'temporaire' || typePaiement === 'CB' ? taux : 0,
          taux_commission: taux,
          commission_personnalisee: personnalise,
          assiette_commission: role === 'temporaire' ? 'tous_paiements' : 'cb',
        }

        const individuel = ajouterCommissionAUnArtisan(data, role, 1.5, 2.5, tauxPersonnalise)
        const groupe = ajouterCommissionsAuxGroupes(
          [{ ...data, artisan_role: role, commission_cb_personnalisee: tauxPersonnalise }],
          1.5,
          2.5,
        )

        expect(individuel.summary).toEqual(attendu)
        expect(groupe.groupesAvecCommissions[0].summary).toEqual(attendu)
        expect(groupe.totalGlobalCB).toBe(attendu.total_cb)
        expect(groupe.totalGlobalCommission).toBe(attendu.commission_cb)
      })
    })
  })

  it('calcule uniquement les commissions des ventes CB', () => {
    const result = calculerCommissions(
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

    expect(result).toEqual({ total_cb: 41, commission_cb: 1.03, assiette_commission: 'cb' })
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

  it('commissionne tous les paiements des invites avec arrondi et anciennes ventes', () => {
    expect(
      calculerCommissions(
        [
          { type_paiement: 'CB', articles: [{ prix: 10, quantite: 2 }] },
          { type_paiement: 'Espece', articles: [{ prix: 5, quantite: 1 }] },
          { type_paiement: 'Cheque', prix: 8, quantite: 2 },
        ],
        2.5,
        'temporaire',
      ),
    ).toEqual({ total_cb: 20, commission_cb: 1.03, assiette_commission: 'tous_paiements' })
  })

  it.each(['permanent', 'temporaire'])('gere un rapport vide pour %s', (role) => {
    expect(calculerCommissions([], 2.5, role)).toMatchObject({ total_cb: 0, commission_cb: 0 })
  })

  it('conserve le role de la vente lorsque le groupe ne le precise pas', () => {
    const result = ajouterCommissionsAuxGroupes(
      [
        {
          ventes: [{ artisan_role: 'temporaire', type_paiement: 'Cheque', prix: 100, quantite: 1 }],
        },
      ],
      1.5,
      2.5,
    )
    expect(result.groupesAvecCommissions[0].summary).toMatchObject({
      total_cb: 0,
      commission_cb: 2.5,
      assiette_commission: 'tous_paiements',
    })
  })

  it('commissionne chaque artisan sur ses propres articles dans les paniers mixtes', () => {
    const ventes = ['CB', 'Espece', 'Cheque'].map((typePaiement) => ({
      type_paiement: typePaiement,
      articles: [
        { artisan_id: 1, prix: 100, quantite: 1 },
        { artisan_id: 2, prix: 50, quantite: 2 },
      ],
    }))
    const data = aggregationService.groupVentesByArtisan(ventes, [
      { id: 1, nom: 'Permanent', role: 'permanent', commission_cb_personnalisee: 4 },
      { id: 2, nom: 'Invite', role: 'temporaire', commission_cb_personnalisee: 3 },
    ])
    const result = ajouterCommissionsAuxGroupes(data.groupes, 1.5, 2.5)

    expect(result.totalGlobalCB).toBe(200)
    expect(result.totalGlobalCommission).toBe(13)
    expect(result.groupesAvecCommissions.find((g) => g.artisan_id === 1).summary).toMatchObject({
      total_montant: 300,
      total_cb: 100,
      commission_cb: 4,
    })
    expect(result.groupesAvecCommissions.find((g) => g.artisan_id === 2).summary).toMatchObject({
      total_montant: 300,
      total_cb: 100,
      commission_cb: 9,
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
      assiette_commission: 'cb',
      taux_commission: 1.25,
      commission_personnalisee: false,
    })
  })
})
