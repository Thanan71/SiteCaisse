/**
 * @module venteAggregationService
 * @description Agrégation pure des ventes pour les rapports.
 * Ce service ne connaît pas Supabase : il transforme uniquement des ventes déjà chargées.
 */
'use strict'

const { addCents, articleAmountInCents, fromCents, toCents } = require('./moneyService.cjs')

function createEmptySummary() {
  return { total_articles: 0, total_montant: 0 }
}

function summarizeArticles(articles = []) {
  let totalArticles = 0
  let totalCents = 0
  for (const article of articles) {
    totalArticles += Number(article.quantite ?? 0)
    totalCents = addCents(totalCents, articleAmountInCents(article))
  }
  return { total_articles: totalArticles, total_montant: fromCents(totalCents) }
}

function summarizeVentes(ventes = []) {
  let totalArticles = 0
  let totalCents = 0
  for (const vente of ventes) {
    const summary = Array.isArray(vente.articles) ? summarizeArticles(vente.articles) : vente
    totalArticles += Number(summary.total_articles ?? 0)
    totalCents = addCents(totalCents, toCents(summary.total_montant))
  }
  return { total_articles: totalArticles, total_montant: fromCents(totalCents) }
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
  return summarizeVentes(groupes.map((groupe) => groupe.summary || createEmptySummary()))
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
  const result = { groupes, total: summarizeGroups(groupes) }
  assertReportConsistency({ ventes, ...result })
  return result
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

  const result = { mois, total: summarizeVentes(ventes) }
  assertReportConsistency({ ventes, ...result })
  return result
}

function groupVentesForMonth(ventes = [], artisans = [], mois) {
  const ventesForMonth = ventes.filter((vente) => vente.date_vente?.startsWith(mois))
  return groupVentesByArtisan(ventesForMonth, artisans)
}

function createStats() {
  return { cents: 0, quantity: 0, lines: 0 }
}

function appendStats(target, source) {
  target.cents = addCents(target.cents, source.cents)
  target.quantity += source.quantity
  target.lines += source.lines
}

function appendStatsByArtisan(target, artisanId, stats) {
  if (!target.has(artisanId)) target.set(artisanId, createStats())
  appendStats(target.get(artisanId), stats)
}

function coherenceError(context) {
  const error = new Error(`Rapport incohérent : ${context}`)
  error.code = 'REPORT_INCONSISTENT'
  return error
}

function assertStats(actual, expected, context) {
  if (
    actual.cents !== expected.cents ||
    actual.quantity !== expected.quantity ||
    actual.lines !== expected.lines
  ) {
    throw coherenceError(context)
  }
}

function assertSummary(summary, expected, context) {
  if (
    !summary ||
    toCents(summary.total_montant) !== expected.cents ||
    Number(summary.total_articles) !== expected.quantity
  ) {
    throw coherenceError(context)
  }
}

function checkGroups(groupes, expected, context) {
  const total = createStats()
  const seen = new Set()
  for (const group of groupes) {
    const artisanId = resolveArtisanId(group)
    if (seen.has(artisanId) || !expected.has(artisanId)) throw coherenceError(context)
    seen.add(artisanId)
    const stats = createStats()
    for (const vente of group.ventes) {
      for (const article of vente.articles || []) {
        if (resolveArtisanId(article) !== artisanId) throw coherenceError(context)
        appendStats(stats, {
          cents: articleAmountInCents(article),
          quantity: Number(article.quantite ?? 0),
          lines: 1,
        })
      }
    }
    assertSummary(group.summary, stats, `${context}, résumé artisan ${artisanId}`)
    assertStats(stats, expected.get(artisanId), `${context}, artisan ${artisanId}`)
    appendStats(total, stats)
  }
  if (seen.size !== expected.size) throw coherenceError(`${context}, artisan manquant`)
  return total
}

/**
 * Vérifie les montants, quantités et nombres de lignes à partir des articles source.
 * Les commissions sont volontairement exclues : leur arrondi dépend de la période.
 * Contrôle linéaire, sans rechargement de données et sans modifier la réponse API.
 */
function assertReportConsistency({ ventes = [], groupes, mois, total }) {
  const expected = createStats()
  const byArtisan = new Map()
  const byMonth = new Map()
  for (const vente of ventes) {
    const month = vente.date_vente?.substring(0, 7)
    if (mois && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '')) {
      throw coherenceError(`date absente ou invalide pour la vente ${vente.id}`)
    }
    if (mois && !byMonth.has(month)) {
      byMonth.set(month, { total: createStats(), artisans: new Map() })
    }
    for (const article of vente.articles || []) {
      const stats = {
        cents: articleAmountInCents(article),
        quantity: Number(article.quantite ?? 0),
        lines: 1,
      }
      const artisanId = resolveArtisanId(article)
      appendStats(expected, stats)
      appendStatsByArtisan(byArtisan, artisanId, stats)
      if (mois) {
        appendStats(byMonth.get(month).total, stats)
        appendStatsByArtisan(byMonth.get(month).artisans, artisanId, stats)
      }
    }
  }

  assertSummary(total, expected, 'total global')
  if (groupes) {
    assertStats(checkGroups(groupes, byArtisan, 'groupes'), expected, 'somme des artisans')
  }
  if (mois) {
    const monthlyTotal = createStats()
    const seen = new Set()
    for (const month of mois) {
      const reference = byMonth.get(month.mois)
      if (!reference || seen.has(month.mois)) throw coherenceError('mois invalide ou dupliqué')
      seen.add(month.mois)
      const stats = checkGroups(month.groupes, reference.artisans, `mois ${month.mois}`)
      assertStats(stats, reference.total, `lignes du mois ${month.mois}`)
      assertSummary(month.total, stats, `total du mois ${month.mois}`)
      appendStats(monthlyTotal, stats)
    }
    if (seen.size !== byMonth.size) throw coherenceError('mois manquant')
    assertStats(monthlyTotal, expected, 'somme des mois')
  }
}

module.exports = {
  assertReportConsistency,
  filterVentesByArtisan,
  groupVentesByArtisan,
  groupVentesByMonth,
  groupVentesForMonth,
  summarizeArticles,
  summarizeVentes,
}
