/**
 * @module venteAggregationService
 * @description Agrégation pure des ventes pour les rapports.
 * Ce service ne connaît pas Supabase : il transforme uniquement des ventes déjà chargées.
 */
'use strict'

function createEmptySummary() {
  return { total_articles: 0, total_montant: 0 }
}

function summarizeArticles(articles = []) {
  return articles.reduce(
    (summary, article) => ({
      total_articles: summary.total_articles + (article.quantite || 0),
      total_montant: summary.total_montant + (article.prix || 0) * (article.quantite || 0),
    }),
    createEmptySummary(),
  )
}

function summarizeVentes(ventes = []) {
  return ventes.reduce(
    (summary, vente) => ({
      total_articles: summary.total_articles + (vente.total_articles || 0),
      total_montant: summary.total_montant + (vente.total_montant || 0),
    }),
    createEmptySummary(),
  )
}

function createArtisanMap(artisans = []) {
  return new Map(artisans.map((artisan) => [Number(artisan.id), artisan]))
}

function resolveArtisanId(article) {
  return article.artisan_id === null || article.artisan_id === undefined
    ? null
    : Number(article.artisan_id)
}

function resolveArtisanName(artisanId, artisanMap) {
  const artisan = artisanMap.get(Number(artisanId))
  if (artisan) return artisan.nom_boutique || artisan.nom
  return artisanId === null ? 'Artisan inconnu' : `Artisan #${artisanId}`
}

function createArtisanGroup(artisanId, artisanMap) {
  const artisan = artisanMap.get(Number(artisanId))
  return {
    artisan_id: artisanId,
    artisan_nom: resolveArtisanName(artisanId, artisanMap),
    artisan_role: artisan?.role || null,
    commission_cb_personnalisee: artisan?.commission_cb_personnalisee ?? null,
    ventes: [],
  }
}

function groupArticlesByArtisan(articles = []) {
  const groups = new Map()

  for (const article of articles) {
    const artisanId = resolveArtisanId(article)
    if (!groups.has(artisanId)) {
      groups.set(artisanId, [])
    }
    groups.get(artisanId).push(article)
  }

  return groups
}

function appendVenteToGroups(groups, vente, articles, artisanMap) {
  const artisanId = resolveArtisanId(articles[0] || {})
  if (!groups.has(artisanId)) {
    groups.set(artisanId, createArtisanGroup(artisanId, artisanMap))
  }

  const totals = summarizeArticles(articles)
  groups.get(artisanId).ventes.push({
    ...vente,
    articles,
    total_articles: totals.total_articles,
    total_montant: totals.total_montant,
  })
}

function buildGroupsArray(groups) {
  return Array.from(groups.values())
    .map((group) => ({
      artisan_id: group.artisan_id,
      artisan_nom: group.artisan_nom,
      artisan_role: group.artisan_role,
      commission_cb_personnalisee: group.commission_cb_personnalisee,
      ventes: group.ventes,
      summary: summarizeVentes(group.ventes),
    }))
    .sort((a, b) => (a.artisan_nom || '').localeCompare(b.artisan_nom || ''))
}

function summarizeGroups(groupes = []) {
  return groupes.reduce(
    (summary, groupe) => ({
      total_articles: summary.total_articles + (groupe.summary?.total_articles || 0),
      total_montant: summary.total_montant + (groupe.summary?.total_montant || 0),
    }),
    createEmptySummary(),
  )
}

function groupVentesByArtisan(ventes = [], artisans = []) {
  const artisanMap = createArtisanMap(artisans)
  const groups = new Map()

  for (const vente of ventes) {
    const articlesByArtisan = groupArticlesByArtisan(vente.articles || [])
    for (const articles of articlesByArtisan.values()) {
      appendVenteToGroups(groups, vente, articles, artisanMap)
    }
  }

  const groupes = buildGroupsArray(groups)
  return { groupes, total: summarizeGroups(groupes) }
}

function filterVentesByArtisan(ventes = [], artisanId) {
  const normalizedArtisanId = Number(artisanId)
  const ventesFiltered = []

  for (const vente of ventes) {
    const articles = (vente.articles || []).filter(
      (article) => Number(article.artisan_id) === normalizedArtisanId,
    )

    if (articles.length > 0) {
      const totals = summarizeArticles(articles)
      ventesFiltered.push({
        ...vente,
        articles,
        total_articles: totals.total_articles,
        total_montant: totals.total_montant,
      })
    }
  }

  return {
    ventes: ventesFiltered,
    summary: summarizeVentes(ventesFiltered),
  }
}

function groupVentesByMonth(ventes = [], artisans = []) {
  const artisanMap = createArtisanMap(artisans)
  const months = new Map()

  for (const vente of ventes) {
    const mois = vente.date_vente?.substring(0, 7)
    if (!mois) continue

    if (!months.has(mois)) {
      months.set(mois, new Map())
    }

    const monthGroups = months.get(mois)
    const articlesByArtisan = groupArticlesByArtisan(vente.articles || [])
    for (const articles of articlesByArtisan.values()) {
      appendVenteToGroups(monthGroups, vente, articles, artisanMap)
    }
  }

  const mois = Array.from(months.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([monthKey, monthGroups]) => {
      const groupes = buildGroupsArray(monthGroups)
      return {
        mois: monthKey,
        groupes,
        total: summarizeGroups(groupes),
      }
    })

  return { mois, total: summarizeVentes(ventes) }
}

function groupVentesForMonth(ventes = [], artisans = [], mois) {
  const ventesForMonth = ventes.filter((vente) => vente.date_vente?.startsWith(mois))
  return groupVentesByArtisan(ventesForMonth, artisans)
}

module.exports = {
  filterVentesByArtisan,
  groupVentesByArtisan,
  groupVentesByMonth,
  groupVentesForMonth,
  summarizeArticles,
  summarizeVentes,
}
