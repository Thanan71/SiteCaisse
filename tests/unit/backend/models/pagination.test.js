import { afterEach, describe, expect, it } from 'vitest'
import { createFakeSupabase } from '../../helpers/fakeSupabase'
import { loadCjsWithMocks } from '../../helpers/loadCjsWithMocks'

const restores = []

function loadModels(fake) {
  const { loaded, restore } = loadCjsWithMocks('api/models.cjs', {
    'api/db.cjs': { getSupabase: () => fake.client },
  })
  restores.push(restore)
  return loaded
}

function createLargeFixture(options = {}) {
  const users = Array.from({ length: 1205 }, (_, index) => ({
    id: index + 1,
    nom: 'Artisan',
    nom_boutique: `Boutique ${index + 1}`,
    role: index === 0 ? 'admin' : index === 1204 ? 'temporaire' : 'permanent',
    est_actif: index !== 1204,
    commission_cb_personnalisee: index === 1204 ? 0 : null,
  })).reverse()
  const ventes = Array.from({ length: 1205 }, (_, index) => ({
    id: index + 1,
    type_paiement: index % 2 === 0 ? 'CB' : 'Espece',
    vendeur_id: 1,
    date_vente: index < 700 ? '2026-07-15' : '2026-08-15',
    // Tous les timestamps sont identiques pour vérifier le départage par ID.
    created_at: '2026-08-15T12:00:00Z',
    vendeur: { nom: 'Admin' },
  }))
  const articles = ventes.flatMap((vente) => [
    {
      id: vente.id * 2 - 1,
      vente_id: vente.id,
      article: 'Bol',
      quantite: 2,
      prix: 12.35,
      artisan_id: 2,
    },
    {
      id: vente.id * 2,
      vente_id: vente.id,
      article: 'Tasse',
      quantite: 1,
      prix: 5.1,
      artisan_id: 1205,
    },
  ])
  // Une seule vente dépasse elle-même le plafond de 1 000 lignes d'articles.
  for (let index = 0; index < 1103; index++) {
    articles.push({
      id: 3000 + index,
      vente_id: 1205,
      article: 'Perle',
      quantite: 3,
      prix: 0.1,
      artisan_id: 2,
    })
  }
  return createFakeSupabase(
    { users, ventes, vente_articles: articles.reverse() },
    { maxRows: 1000, ...options },
  )
}

afterEach(() => {
  for (const restore of restores.splice(0).reverse()) restore()
})

describe('chargement exhaustif des rapports', () => {
  it.each([
    1000, 137,
  ])('charge toutes les ventes et tous les articles avec un plafond API de %i lignes', async (maxRows) => {
    const fake = createLargeFixture({ maxRows })
    const models = loadModels(fake)

    const ventes = await models.getAllVentesUnpaginated()

    expect(ventes.map((vente) => vente.id)).toEqual(
      Array.from({ length: 1205 }, (_, index) => 1205 - index),
    )
    expect(ventes.flatMap((vente) => vente.articles)).toHaveLength(3513)
    expect(ventes[0].articles).toHaveLength(1105)
    expect(ventes[0].articles.map((article) => article.id)).toEqual([
      2409,
      2410,
      ...Array.from({ length: 1103 }, (_, index) => 3000 + index),
    ])
    expect(ventes.reduce((sum, vente) => sum + vente.total_articles, 0)).toBe(6924)
    expect(ventes.reduce((sum, vente) => sum + vente.total_montant, 0)).toBeCloseTo(36239.9, 8)

    const articleFilters = fake.calls.filter(
      (call) => call.tableName === 'vente_articles' && call.method === 'in',
    )
    expect(articleFilters.length).toBeGreaterThan(6)
    expect(articleFilters.every((call) => call.values.length <= 200)).toBe(true)
    const venteOffsets = fake.calls
      .filter((call) => call.tableName === 'ventes' && call.method === 'range')
      .map((call) => call.from)
    expect(venteOffsets[1]).toBe(maxRows)
  })

  it('conserve tous les profils, y compris un invité archivé au taux personnalisé de 0 %', async () => {
    const fake = createLargeFixture({ maxRows: 137 })
    const models = loadModels(fake)

    const artisans = await models.getAllArtisans({ includeInactive: true })
    expect(artisans.map((artisan) => artisan.id)).toEqual(
      Array.from({ length: 1204 }, (_, index) => index + 2),
    )
    expect(artisans.at(-1)).toMatchObject({
      id: 1205,
      role: 'temporaire',
      est_actif: false,
      commission_cb_personnalisee: 0,
    })
    expect(await models.getAllArtisans()).toHaveLength(1203)

    const report = await models.getAllVentesGroupedByArtisan()
    expect(report.groupes.find((groupe) => groupe.artisan_id === 1205)).toMatchObject({
      artisan_nom: 'Boutique 1205',
      artisan_role: 'temporaire',
      commission_cb_personnalisee: 0,
    })
    expect(report.total.total_articles).toBe(6924)
    expect(report.total.total_montant).toBeCloseTo(36239.9, 8)
  })

  it('alimente les rapports artisan, mensuels et détaillés sans perte au-delà de 1 000 ventes', async () => {
    const models = loadModels(createLargeFixture({ maxRows: 137 }))

    const artisan = await models.getVentesByArtisan(2)
    expect(artisan.ventes).toHaveLength(1205)
    expect(artisan.summary.total_articles).toBe(5719)
    expect(artisan.summary.total_montant).toBeCloseTo(30094.4, 8)

    const monthly = await models.getAllVentesGroupedByMonth()
    expect(monthly.total.total_articles).toBe(6924)
    expect(monthly.total.total_montant).toBeCloseTo(36239.9, 8)
    expect(monthly.mois.map((month) => month.mois)).toEqual(['2026-08', '2026-07'])
    expect(monthly.mois[0].total.total_articles).toBe(4824)
    expect(monthly.mois[0].total.total_montant).toBeCloseTo(15379.9, 8)
    expect(monthly.mois[1].total.total_articles).toBe(2100)
    expect(monthly.mois[1].total.total_montant).toBeCloseTo(20860, 8)

    const month = await models.getVentesByMonth('2026-08')
    expect(month.total).toEqual(monthly.mois[0].total)
  })

  it('remplit une page filtrée malgré un plafond API inférieur à limit et conserve le contrat UI', async () => {
    const models = loadModels(createLargeFixture({ maxRows: 17 }))
    const result = await models.getAllVentes({
      page: 2,
      limit: 100,
      date_debut: '2026-08-01',
      date_fin: '2026-08-31',
      type_paiement: 'CB',
    })

    expect(result.pagination).toEqual({ page: 2, limit: 100, total: 253, totalPages: 3 })
    expect(result.ventes.map((vente) => vente.id)).toEqual(
      Array.from({ length: 100 }, (_, index) => 1005 - index * 2),
    )
    expect(result.ventes.every((vente) => vente.articles.length === 2)).toBe(true)
    await expect(models.getAllVentes({ page: 20, limit: 100 })).resolves.toEqual({
      ventes: [],
      pagination: { page: 20, limit: 100, total: 1205, totalPages: 13 },
    })
  })

  it.each([
    ['ventes', (query) => query.tableName === 'ventes' && query.rangeBounds?.from >= 1000],
    [
      'articles de la même vente',
      (query) => query.tableName === 'vente_articles' && query.rangeBounds?.from >= 1000,
    ],
    [
      "articles d'un lot suivant",
      (query) =>
        query.tableName === 'vente_articles' &&
        query.getFilteredRows().some((article) => article.vente_id === 1005),
    ],
    ['artisans', (query) => query.tableName === 'users' && query.rangeBounds?.from >= 1000],
  ])('rejette le rapport entier en cas d’erreur tardive sur les %s', async (_, shouldFail) => {
    const error = { code: 'XX000', message: 'Panne après une page réussie' }
    const fake = createLargeFixture({
      getQueryError: (query) => (shouldFail(query) ? error : null),
    })
    const models = loadModels(fake)

    await expect(models.getAllVentesGroupedByArtisan()).rejects.toEqual(error)
  })

  it('retourne les structures vides attendues sans requête articles sur une base vide', async () => {
    const fake = createFakeSupabase({}, { maxRows: 1000 })
    const models = loadModels(fake)

    await expect(models.getAllVentesUnpaginated()).resolves.toEqual([])
    await expect(models.getAllVentesGroupedByMonth()).resolves.toEqual({
      mois: [],
      total: { total_articles: 0, total_montant: 0 },
    })
    expect(fake.calls.some((call) => call.tableName === 'vente_articles')).toBe(false)
  })
})
