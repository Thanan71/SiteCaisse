/** Audit en lecture seule : aucune donnée nominative ni clé dans la sortie. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { getSupabase } from '../api/db.cjs'
import { getAllVentesUnpaginated } from '../api/models.cjs'
import {
  getRapportArtisan,
  getRapportGlobal,
  getRapportMensuel,
  getRapportParMois,
} from '../api/services/rapportService.cjs'

// Lecture indépendante des helpers applicatifs, par curseur sur la clé primaire.
async function readTable(supabase, table, columns) {
  const rows = []
  let cursor = null
  let expectedCount = null
  while (true) {
    let query = supabase.from(table).select(columns, { count: 'exact' }).order('id').limit(500)
    if (cursor !== null) query = query.gt('id', cursor)
    const { data, count, error } = await query
    if (error) throw error
    if (expectedCount === null) expectedCount = count
    if (!data?.length) break
    const nextCursor = data.at(-1).id
    assert.ok(cursor === null || nextCursor > cursor, 'Curseur de lecture sans progression')
    rows.push(...data)
    cursor = nextCursor
  }
  assert.equal(rows.length, expectedCount, `Chargement incomplet : ${table}`)
  return rows
}

async function readReference(supabase) {
  const [ventes, articles, artisans, parametres] = await Promise.all([
    readTable(supabase, 'ventes', 'id,type_paiement,date_vente'),
    readTable(supabase, 'vente_articles', 'id,vente_id,artisan_id,prix,quantite'),
    readTable(supabase, 'users', 'id,role,commission_cb_personnalisee'),
    readTable(supabase, 'parametres', 'id,cle,valeur'),
  ])
  return { ventes, articles, artisans, parametres }
}

// Référence décimale indépendante : conversion textuelle, puis arithmétique BigInt.
export function decimalHundredths(value) {
  const match = String(value).match(/^(\d+)(?:\.(\d{1,2}))?$/)
  assert.ok(match, 'Valeur de référence attendue avec au plus deux décimales')
  return BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0'))
}

function emptyTotals() {
  return { quantite: 0, montant: 0n, cb: 0n }
}

function addLine(totals, article, paiement) {
  const montant = decimalHundredths(article.prix) * BigInt(article.quantite)
  totals.quantite += article.quantite
  totals.montant += montant
  if (paiement === 'CB') totals.cb += montant
}

function euros(cents) {
  assert.ok(cents <= BigInt(Number.MAX_SAFE_INTEGER), 'Montant hors précision JavaScript')
  return Number(cents) / 100
}

function expectedSummary(totals, artisan, params) {
  const role = artisan?.role || 'permanent'
  const custom = artisan?.commission_cb_personnalisee
  const taux =
    custom ?? params[`commission_cb_${role === 'temporaire' ? 'temporaire' : 'permanent'}`] ?? 0
  const base = role === 'temporaire' ? totals.montant : totals.cb
  // Un taux de 1,70 % est 170 / 10 000 ; conserver aussi les taux plus précis.
  const rate = String(taux).replace(',', '.')
  assert.match(rate, /^\d+(?:\.\d+)?$/, 'Taux de référence invalide')
  const decimals = rate.split('.')[1]?.length || 0
  const divisor = 100n * 10n ** BigInt(decimals)
  const commission = (base * BigInt(rate.replace('.', '')) + divisor / 2n) / divisor
  return {
    total_articles: totals.quantite,
    total_montant: euros(totals.montant),
    total_cb: euros(totals.cb),
    commission_cb: euros(commission),
  }
}

export function buildReference(reference, month = null) {
  const sales = new Map(reference.ventes.map((vente) => [vente.id, vente]))
  const artisans = new Map(
    reference.artisans
      .filter((artisan) => ['permanent', 'temporaire'].includes(artisan.role))
      .map((artisan) => [artisan.id, artisan]),
  )
  const params = Object.fromEntries(reference.parametres.map((p) => [p.cle, p.valeur]))
  const groups = new Map()
  const total = emptyTotals()
  for (const article of reference.articles) {
    const sale = sales.get(article.vente_id)
    assert.ok(sale, 'Ligne article sans vente')
    if (month && !sale.date_vente.startsWith(month)) continue
    if (!groups.has(article.artisan_id)) groups.set(article.artisan_id, emptyTotals())
    addLine(groups.get(article.artisan_id), article, sale.type_paiement)
    addLine(total, article, sale.type_paiement)
  }
  const summaries = new Map(
    [...groups].map(([id, totals]) => [id, expectedSummary(totals, artisans.get(id), params)]),
  )
  return {
    summaries,
    total: {
      total_articles: total.quantite,
      total_montant: euros(total.montant),
      total_cb: euros(total.cb),
      total_commission: euros(
        [...summaries.values()].reduce(
          (sum, item) => sum + decimalHundredths(item.commission_cb),
          0n,
        ),
      ),
    },
  }
}

function compareFields(actual, expected, label) {
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(actual[key], value, `${label} : ${key}`)
  }
}

function compareGroups(actual, expected, label) {
  compareFields(actual.total, expected.total, label)
  assert.equal(actual.groupes.length, expected.summaries.size, `${label} : nombre de groupes`)
  assert.equal(new Set(actual.groupes.map((g) => g.artisan_id)).size, actual.groupes.length)
  for (const group of actual.groupes) {
    const summary = expected.summaries.get(group.artisan_id)
    assert.ok(summary, `${label} : groupe inattendu`)
    compareFields(group.summary, summary, `${label} / artisan`)
  }
}

function fingerprint(reference) {
  return createHash('sha256').update(JSON.stringify(reference)).digest('hex')
}

export async function auditRapports() {
  const supabase = getSupabase()
  const before = await readReference(supabase)
  const expected = buildReference(before)
  const ventes = await getAllVentesUnpaginated()
  assert.deepEqual(
    ventes.map((v) => v.id).sort((a, b) => a - b),
    before.ventes.map((v) => v.id),
    'Exhaustivité des ventes',
  )
  assert.deepEqual(
    ventes.flatMap((v) => v.articles.map((a) => a.id)).sort((a, b) => a - b),
    before.articles.map((a) => a.id),
    'Exhaustivité des articles',
  )
  compareGroups(await getRapportGlobal(), expected, 'Global')
  const mensuel = await getRapportMensuel()
  compareFields(
    mensuel.total,
    {
      total_articles: expected.total.total_articles,
      total_montant: expected.total.total_montant,
    },
    'Mensuel',
  )
  const months = [...new Set(before.ventes.map((v) => v.date_vente.slice(0, 7)))].sort()
  assert.deepEqual(mensuel.mois.map((m) => m.mois).sort(), months, 'Exhaustivité des mois')
  for (const month of mensuel.mois) {
    const expectedMonth = buildReference(before, month.mois)
    compareGroups(month, expectedMonth, 'Mensuel / mois')
    compareGroups(await getRapportParMois(month.mois), expectedMonth, 'Par mois')
  }
  for (const [id, summary] of expected.summaries) {
    if (id !== null) compareFields((await getRapportArtisan(id)).summary, summary, 'Artisan')
  }
  const after = await readReference(supabase)
  assert.equal(
    fingerprint(before),
    fingerprint(after),
    'Données modifiées pendant l’audit : relancer',
  )
  return {
    statut: 'conforme',
    ventes: before.ventes.length,
    lignes_articles: before.articles.length,
    groupes_artisans: expected.summaries.size,
    mois: months.length,
    ...expected.total,
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  auditRapports()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch(() => {
      // Une erreur SDK peut contenir une URL ou une donnée : ne pas la publier dans les logs.
      console.error(
        'Audit non conforme ou lecture impossible. Vérifier l’accès et relancer au calme.',
      )
      process.exitCode = 1
    })
}
