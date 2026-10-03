import { describe, expect, it } from 'vitest'
import { buildReference, decimalHundredths } from '../../../../scripts/audit-rapports.mjs'

describe('référence indépendante de l’audit des rapports', () => {
  it('calcule exactement plus de 1 000 lignes et respecte le taux personnalisé nul', () => {
    const reference = {
      ventes: [
        { id: 1, type_paiement: 'CB', date_vente: '2026-01-10' },
        { id: 2, type_paiement: 'Espece', date_vente: '2026-02-10' },
      ],
      articles: [
        ...Array.from({ length: 1001 }, (_, index) => ({
          id: index + 1,
          vente_id: 1,
          artisan_id: 1,
          prix: '0.10',
          quantite: 3,
        })),
        { id: 1002, vente_id: 2, artisan_id: 2, prix: '12.50', quantite: 2 },
        { id: 1003, vente_id: 2, artisan_id: 3, prix: '12.50', quantite: 2 },
      ],
      artisans: [
        { id: 1, role: 'permanent', commission_cb_personnalisee: null },
        { id: 2, role: 'temporaire', commission_cb_personnalisee: null },
        { id: 3, role: 'temporaire', commission_cb_personnalisee: 0 },
      ],
      parametres: [
        { cle: 'commission_cb_permanent', valeur: '1.70' },
        { cle: 'commission_cb_temporaire', valeur: '5' },
      ],
    }

    const global = buildReference(reference)
    expect(global.total).toEqual({
      total_articles: 3007,
      total_montant: 350.3,
      total_cb: 300.3,
      total_commission: 6.36,
    })
    expect(global.summaries.get(1).commission_cb).toBe(5.11)
    expect(global.summaries.get(2).commission_cb).toBe(1.25)
    expect(global.summaries.get(3).commission_cb).toBe(0)
    expect(buildReference(reference, '2026-02').total).toEqual({
      total_articles: 4,
      total_montant: 50,
      total_cb: 0,
      total_commission: 1.25,
    })
  })

  it('refuse une référence orpheline et les décimales hors contrat', () => {
    expect(() =>
      buildReference({ ventes: [], articles: [{ vente_id: 1 }], artisans: [], parametres: [] }),
    ).toThrow('Ligne article sans vente')
    expect(() => decimalHundredths('1.001')).toThrow()
    expect(() => decimalHundredths('NaN')).toThrow()
  })

  it('conserve la précision des taux généraux avec une virgule', () => {
    const reference = {
      ventes: [{ id: 1, type_paiement: 'CB', date_vente: '2026-01-10' }],
      articles: [{ id: 1, vente_id: 1, artisan_id: 1, prix: 200, quantite: 1 }],
      artisans: [{ id: 1, role: 'permanent', commission_cb_personnalisee: null }],
      parametres: [{ cle: 'commission_cb_permanent', valeur: '1,705' }],
    }
    expect(buildReference(reference).total.total_commission).toBe(3.41)
  })
})
