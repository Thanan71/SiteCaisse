import { describe, expect, it } from 'vitest'
import aggregationService from '../../../../api/services/venteAggregationService.cjs'

const {
  assertReportConsistency,
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

    expect(result.total).toEqual({ total_articles: 7, total_montant: 77 })
    expect(result.mois.map((mois) => mois.mois)).toEqual(['2026-07', '2026-06'])
    expect(result.mois[0].total).toEqual({ total_articles: 4, total_montant: 62 })
    expect(result.mois[1].total).toEqual({ total_articles: 3, total_montant: 15 })
  })

  it('additionne exactement les centimes et normalise les nombres issus de la base', () => {
    expect(
      summarizeArticles([
        { prix: '0.1', quantite: '3' },
        { prix: '0.2', quantite: '2' },
        { prix: '0.3', quantite: '1' },
      ]),
    ).toEqual({ total_articles: 6, total_montant: 1 })
    expect(
      summarizeVentes([
        { total_articles: 1, total_montant: 0.1 },
        { total_articles: 1, total_montant: 0.2 },
      ]),
    ).toEqual({ total_articles: 2, total_montant: 0.3 })
  })

  it('calcule les résumés depuis les articles quand ils sont disponibles', () => {
    expect(summarizeVentes([{ ...ventes[0], total_articles: 99, total_montant: 9999 }])).toEqual({
      total_articles: 3,
      total_montant: 32,
    })
  })

  it('conserve les totaux exacts par artisan et par mois avec 1 203 ventes et 3 609 lignes', () => {
    const manyVentes = Array.from({ length: 1203 }, (_, index) => ({
      id: index + 1,
      date_vente: `2026-0${(index % 3) + 1}-15`,
      articles: [
        { artisan_id: 1, prix: '0.1', quantite: 3 },
        { artisan_id: 2, prix: '0.2', quantite: 2 },
        { artisan_id: null, prix: '0.3', quantite: 1 },
      ],
    }))
    const global = groupVentesByArtisan(manyVentes, artisans)
    const monthly = groupVentesByMonth(manyVentes, artisans)

    expect(global.total).toEqual({ total_articles: 7218, total_montant: 1203 })
    expect(monthly.total).toEqual(global.total)
    expect(global.groupes.find((group) => group.artisan_id === 1).summary).toEqual({
      total_articles: 3609,
      total_montant: 360.9,
    })
    expect(global.groupes.find((group) => group.artisan_id === 2).summary).toEqual({
      total_articles: 2406,
      total_montant: 481.2,
    })
    expect(global.groupes.find((group) => group.artisan_id === null)).toMatchObject({
      artisan_nom: 'Artisan inconnu',
      summary: { total_articles: 1203, total_montant: 360.9 },
    })
    expect(monthly.mois).toHaveLength(3)
    for (const month of monthly.mois) {
      expect(month.total).toEqual({ total_articles: 2406, total_montant: 401 })
    }
    expect(() =>
      assertReportConsistency({ ventes: manyVentes, ...global, mois: monthly.mois }),
    ).not.toThrow()
  })

  it.each([
    'global',
    'artisan',
    'mois',
    'mois absent',
    'ligne absente',
    'artisan incorrect',
  ])('refuse un rapport altéré : %s', (caseName) => {
    const data = {
      ventes,
      ...structuredClone(groupVentesByArtisan(ventes, artisans)),
      mois: structuredClone(groupVentesByMonth(ventes, artisans).mois),
    }
    if (caseName === 'global') data.total.total_montant -= 0.01
    if (caseName === 'artisan') data.groupes[0].summary.total_articles -= 1
    if (caseName === 'mois') data.mois[0].total.total_montant -= 0.01
    if (caseName === 'mois absent') data.mois.pop()
    if (caseName === 'ligne absente') data.groupes[0].ventes[0].articles.pop()
    if (caseName === 'artisan incorrect') data.groupes[0].ventes[0].articles[0].artisan_id = 2

    expect(() => assertReportConsistency(data)).toThrow(
      expect.objectContaining({ code: 'REPORT_INCONSISTENT' }),
    )
  })

  it('détecte aussi la perte d une ligne historique sans valeur ni quantité', () => {
    const source = [
      {
        ...ventes[0],
        articles: [...ventes[0].articles, { artisan_id: 1, prix: 0, quantite: 0 }],
      },
    ]
    const data = groupVentesByArtisan(source, artisans)
    data.groupes[0].ventes[0].articles.pop()
    expect(() => assertReportConsistency({ ventes: source, ...data })).toThrow(
      expect.objectContaining({ code: 'REPORT_INCONSISTENT' }),
    )
  })

  it.each([
    undefined,
    '',
    '2026-13-01',
  ])('refuse de masquer une vente dont le mois est invalide : %s', (dateVente) => {
    expect(() => groupVentesByMonth([{ ...ventes[0], date_vente: dateVente }], artisans)).toThrow(
      expect.objectContaining({ code: 'REPORT_INCONSISTENT' }),
    )
  })

  it('accepte les rapports vides', () => {
    expect(groupVentesByArtisan([])).toEqual({
      groupes: [],
      total: { total_articles: 0, total_montant: 0 },
    })
    expect(groupVentesByMonth([])).toEqual({
      mois: [],
      total: { total_articles: 0, total_montant: 0 },
    })
  })
})
