import { describe, expect, it } from 'vitest'
import aggregationService from '../../../../api/services/venteAggregationService.cjs'

const {
  filterVentesByArtisan,
  groupVentesByArtisan,
  groupVentesByMonth,
  summarizeArticles,
  summarizeVentes,
} = aggregationService

const artisans = [
  {
    id: 1,
    nom: 'Alice',
    nom_boutique: 'Atelier Alice',
    role: 'permanent',
    commission_cb_personnalisee: null,
  },
  {
    id: 2,
    nom: 'Bruno',
    nom_boutique: 'Boutique Bruno',
    role: 'temporaire',
    commission_cb_personnalisee: 2.5,
  },
]

const ventes = [
  {
    id: 10,
    type_paiement: 'CB',
    date_vente: '2026-07-08',
    created_at: '2026-07-08T09:00:00Z',
    articles: [
      { id: 100, article: 'Bol', quantite: 2, prix: 12, artisan_id: 1 },
      { id: 101, article: 'Tasse', quantite: 1, prix: 8, artisan_id: 2 },
    ],
  },
  {
    id: 11,
    type_paiement: 'Espece',
    date_vente: '2026-07-10',
    created_at: '2026-07-10T09:00:00Z',
    articles: [{ id: 102, article: 'Vase', quantite: 1, prix: 30, artisan_id: 1 }],
  },
  {
    id: 12,
    type_paiement: 'Cheque',
    date_vente: '2026-06-30',
    created_at: '2026-06-30T09:00:00Z',
    articles: [{ id: 103, article: 'Cadre', quantite: 3, prix: 5, artisan_id: 2 }],
  },
]

describe('venteAggregationService', () => {
  it('resume des articles et des ventes deja agregees', () => {
    expect(summarizeArticles(ventes[0].articles)).toEqual({
      total_articles: 3,
      total_montant: 32,
    })

    expect(
      summarizeVentes([
        { total_articles: 3, total_montant: 32 },
        { total_articles: 1, total_montant: 30 },
      ]),
    ).toEqual({
      total_articles: 4,
      total_montant: 62,
    })
  })

  it('separe une vente multi-artisans dans les bons groupes', () => {
    const result = groupVentesByArtisan(ventes, artisans)

    expect(result.total).toEqual({ total_articles: 7, total_montant: 77 })
    expect(result.groupes).toHaveLength(2)

    const alice = result.groupes.find((groupe) => groupe.artisan_id === 1)
    expect(alice).toMatchObject({
      artisan_nom: 'Atelier Alice',
      artisan_role: 'permanent',
      summary: { total_articles: 3, total_montant: 54 },
    })
    expect(alice.ventes.map((vente) => vente.id)).toEqual([10, 11])
    expect(alice.ventes[0].articles).toEqual([ventes[0].articles[0]])

    const bruno = result.groupes.find((groupe) => groupe.artisan_id === 2)
    expect(bruno).toMatchObject({
      artisan_nom: 'Boutique Bruno',
      artisan_role: 'temporaire',
      commission_cb_personnalisee: 2.5,
      summary: { total_articles: 4, total_montant: 23 },
    })
    expect(bruno.ventes.map((vente) => vente.id)).toEqual([10, 12])
  })

  it('filtre les ventes en conservant seulement les articles de l artisan', () => {
    const result = filterVentesByArtisan(ventes, 2)

    expect(result.summary).toEqual({ total_articles: 4, total_montant: 23 })
    expect(result.ventes).toHaveLength(2)
    expect(result.ventes[0]).toMatchObject({
      id: 10,
      total_articles: 1,
      total_montant: 8,
      articles: [ventes[0].articles[1]],
    })
  })

  it('groupe les ventes par mois du plus recent au plus ancien', () => {
    const result = groupVentesByMonth(ventes, artisans)

    expect(result.total).toEqual({ total_articles: 0, total_montant: 0 })
    expect(result.mois.map((mois) => mois.mois)).toEqual(['2026-07', '2026-06'])
    expect(result.mois[0].total).toEqual({ total_articles: 4, total_montant: 62 })
    expect(result.mois[1].total).toEqual({ total_articles: 3, total_montant: 15 })
  })
})
