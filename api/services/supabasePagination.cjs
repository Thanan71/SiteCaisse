/**
 * Charge un ensemble ordonné sans dépendre du plafond de lignes configuré côté API.
 * createQuery doit recréer la requête et lui appliquer les options de select reçues.
 * Le tri doit être déterministe et inclure une clé unique (id).
 * Les requêtes successives ne constituent pas un instantané transactionnel.
 */
const PAGE_SIZE = 1000

function assertExactCount(count) {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error('Chargement Supabase incomplet : décompte exact indisponible')
  }
}

async function fetchAllRows(createQuery, { offset = 0, limit = Infinity, total } = {}) {
  const rows = []
  const seenIds = new Set()
  let expectedTotal = total
  if (expectedTotal !== undefined) assertExactCount(expectedTotal)
  let targetSize =
    expectedTotal === undefined ? limit : Math.min(limit, Math.max(0, total - offset))

  while (rows.length < targetSize) {
    const from = offset + rows.length
    const size = Math.min(PAGE_SIZE, targetSize - rows.length)
    const selectOptions = expectedTotal === undefined ? { count: 'exact' } : {}
    const { data, count, error } = await createQuery(selectOptions).range(from, from + size - 1)
    if (error) throw error

    if (expectedTotal === undefined) {
      assertExactCount(count)
      expectedTotal = count
      targetSize = Math.min(limit, Math.max(0, expectedTotal - offset))
    }

    if (!Array.isArray(data) || (data.length === 0 && rows.length < targetSize)) {
      throw new Error('Chargement Supabase incomplet : page attendue manquante')
    }
    if (rows.length + data.length > targetSize) {
      throw new Error('Chargement Supabase incohérent : le nombre de lignes a changé')
    }

    for (const row of data) {
      const id = String(row.id)
      if (seenIds.has(id)) {
        throw new Error('Chargement Supabase incohérent : une ligne a été reçue plusieurs fois')
      }
      seenIds.add(id)
      rows.push(row)
    }
  }

  return rows
}

module.exports = { fetchAllRows }
