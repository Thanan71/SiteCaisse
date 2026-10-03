import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { fetchAllRows } = require('../../../../api/services/supabasePagination.cjs')

function queryWithResponses(responses) {
  const range = vi.fn(async () => responses.shift())
  const createQuery = vi.fn(() => ({ range }))
  return { range, createQuery }
}

describe('pagination Supabase', () => {
  it('ne confond pas page écourtée par le serveur et fin des résultats', async () => {
    const { range, createQuery } = queryWithResponses([
      { data: [{ id: 1 }, { id: 2 }], count: 3, error: null },
      { data: [{ id: 3 }], count: null, error: null },
    ])

    await expect(fetchAllRows(createQuery)).resolves.toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
    expect(range.mock.calls).toEqual([
      [0, 999],
      [2, 2],
    ])
    expect(createQuery.mock.calls).toEqual([[{ count: 'exact' }], [{}]])
  })

  it('termine sur une page exactement pleine sans demander une plage hors limites', async () => {
    const rows = Array.from({ length: 1000 }, (_, index) => ({ id: index + 1 }))
    const { range, createQuery } = queryWithResponses([{ data: rows, count: 1000, error: null }])

    await expect(fetchAllRows(createQuery)).resolves.toEqual(rows)
    expect(range).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['décompte absent', [{ data: [{ id: 1 }], count: null, error: null }], 'décompte exact'],
    ['décompte négatif', [{ data: [], count: -1, error: null }], 'décompte exact'],
    ['données absentes', [{ data: null, count: 1, error: null }], 'page attendue'],
    [
      'page vide prématurée',
      [
        { data: [{ id: 1 }], count: 2, error: null },
        { data: [], count: null, error: null },
      ],
      'page attendue',
    ],
    [
      'doublon entre pages',
      [
        { data: [{ id: 1 }], count: 2, error: null },
        { data: [{ id: 1 }], count: null, error: null },
      ],
      'plusieurs fois',
    ],
    [
      'nombre de lignes supérieur au décompte initial',
      [{ data: [{ id: 1 }, { id: 2 }], count: 1, error: null }],
      'nombre de lignes a changé',
    ],
  ])('rejette un chargement incohérent : %s', async (_, responses, message) => {
    const { createQuery } = queryWithResponses(responses)

    await expect(fetchAllRows(createQuery)).rejects.toThrow(message)
  })

  it('rejette aussi un count fourni invalide avant de traiter une page UI comme vide', async () => {
    const { createQuery } = queryWithResponses([])

    await expect(fetchAllRows(createQuery, { total: null, limit: 10 })).rejects.toThrow(
      'décompte exact',
    )
    expect(createQuery).not.toHaveBeenCalled()
  })
})
