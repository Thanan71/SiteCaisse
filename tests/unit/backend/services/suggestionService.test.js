import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase } from '../../helpers/fakeSupabase'
import { loadCjsWithMocks } from '../../helpers/loadCjsWithMocks'

const restores = []
const auteur = { id: 2, nom: 'Alice', nom_boutique: 'Atelier Alice' }

function loadService(suggestions = []) {
  const fake = createFakeSupabase({ suggestions })
  const { loaded: service, restore } = loadCjsWithMocks('api/services/suggestionService.cjs', {
    'api/db.cjs': { getSupabase: () => fake.client },
  })
  restores.push(restore)
  return { service, fake }
}

afterEach(() => {
  while (restores.length) restores.pop()()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('suggestionService', () => {
  it('cree une idee nettoyee avec auteur authentifie et statut nouvelle imposes', async () => {
    const { service, fake } = loadService()
    const suggestion = await service.createSuggestion(
      {
        titre: '  Export des ventes  ',
        description: '  Ajouter un export par jour.  ',
        statut: 'acceptee',
        auteur_id: 99,
        auteur_nom: 'Usurpation',
        auteur_nom_boutique: 'Autre boutique',
        created_at: '2000-01-01',
      },
      auteur,
    )

    expect(suggestion).toEqual({
      id: 1,
      titre: 'Export des ventes',
      description: 'Ajouter un export par jour.',
      statut: 'nouvelle',
      auteur_id: 2,
      auteur_nom: 'Alice',
      auteur_nom_boutique: 'Atelier Alice',
    })
    expect(fake.tables.suggestions).toEqual([suggestion])
    expect(fake.calls.find((call) => call.method === 'select').columns).toBe(
      'id, titre, description, statut, auteur_id, auteur_nom, auteur_nom_boutique, created_at, updated_at',
    )
  })

  it('accepte les tailles maximales apres suppression des espaces exterieurs', async () => {
    const { service } = loadService()
    const suggestion = await service.createSuggestion(
      { titre: ` ${'t'.repeat(120)} `, description: ` ${'d'.repeat(2000)} ` },
      auteur,
    )
    expect(suggestion.titre).toHaveLength(120)
    expect(suggestion.description).toHaveLength(2000)
  })

  it.each([
    null,
    {},
    { titre: 123, description: 'Description' },
    { titre: ['Titre'], description: 'Description' },
    { titre: '   ', description: 'Description' },
    { titre: 't'.repeat(121), description: 'Description' },
    { titre: 'Titre', description: '' },
    { titre: 'Titre', description: { texte: 'Description' } },
    { titre: 'Titre', description: 'd'.repeat(2001) },
  ])('rejette le contenu invalide avant ecriture (cas %#)', async (body) => {
    const { service, fake } = loadService()
    await expect(service.createSuggestion(body, auteur)).rejects.toMatchObject({ statusCode: 400 })
    expect(fake.calls).toEqual([])
  })

  it('filtre et pagine les resultats avec un ordre date puis id stable', async () => {
    const { service, fake } = loadService([
      { id: 1, statut: 'nouvelle', created_at: '2026-09-30T21:59:59.999999Z' },
      { id: 2, statut: 'nouvelle', created_at: '2026-09-30T22:00:00.000Z' },
      { id: 3, statut: 'nouvelle', created_at: '2026-10-01T12:00:00.000000Z' },
      { id: 4, statut: 'nouvelle', created_at: '2026-10-01T12:00:00.000000Z' },
      { id: 5, statut: 'nouvelle', created_at: '2026-10-01T21:59:59.999999Z' },
      { id: 6, statut: 'nouvelle', created_at: '2026-10-01T22:00:00.000Z' },
      { id: 7, statut: 'refusee', created_at: '2026-10-01T12:00:00.000000Z' },
    ])
    const filters = {
      statut: 'nouvelle',
      date_debut: '2026-10-01',
      date_fin: '2026-10-01',
      limit: '2',
    }

    const firstPage = await service.listSuggestions(filters)
    const secondPage = await service.listSuggestions({ ...filters, page: '2' })
    expect(firstPage).toMatchObject({ total: 4, page: 1, limit: 2 })
    expect(firstPage.suggestions.map((suggestion) => suggestion.id)).toEqual([5, 4])
    expect(secondPage.suggestions.map((suggestion) => suggestion.id)).toEqual([3, 2])
    const oldestFirst = await service.listSuggestions({ ...filters, ordre: 'asc' })
    expect(oldestFirst.suggestions.map((suggestion) => suggestion.id)).toEqual([2, 3])
    expect(fake.calls).toContainEqual({
      method: 'lt',
      tableName: 'suggestions',
      column: 'created_at',
      value: '2026-10-01T22:00:00.000Z',
    })
    expect(fake.calls.filter((call) => call.method === 'select')).toEqual(
      expect.arrayContaining([expect.objectContaining({ options: { count: 'exact' } })]),
    )
  })

  it.each([
    ['2026-01-15', '2026-01-14T23:00:00.000Z', '2026-01-15T23:00:00.000Z'],
    ['2026-10-01', '2026-09-30T22:00:00.000Z', '2026-10-01T22:00:00.000Z'],
    ['2026-03-29', '2026-03-28T23:00:00.000Z', '2026-03-29T22:00:00.000Z'],
    ['2026-10-25', '2026-10-24T22:00:00.000Z', '2026-10-25T23:00:00.000Z'],
  ])('filtre tout le jour civil Paris %s, y compris les jours de 23 h et 25 h', async (day, start, end) => {
    const { service, fake } = loadService([
      { id: 1, created_at: new Date(new Date(start).getTime() - 1).toISOString() },
      { id: 2, created_at: start },
      { id: 3, created_at: new Date(new Date(end).getTime() - 1).toISOString() },
      { id: 4, created_at: end },
    ])

    const result = await service.listSuggestions({ date_debut: day, date_fin: day, ordre: 'asc' })

    expect(result.suggestions.map((suggestion) => suggestion.id)).toEqual([2, 3])
    expect(result.total).toBe(2)
    expect(fake.calls).toContainEqual({
      method: 'gte',
      tableName: 'suggestions',
      column: 'created_at',
      value: start,
    })
    expect(fake.calls).toContainEqual({
      method: 'lt',
      tableName: 'suggestions',
      column: 'created_at',
      value: end,
    })
  })

  it('inclut une suggestion apres minuit Paris meme si sa date UTC est la veille', async () => {
    const { service } = loadService([{ id: 1, created_at: '2026-09-30T22:30:00.000Z' }])

    await expect(
      service.listSuggestions({ date_debut: '2026-10-01', date_fin: '2026-10-01' }),
    ).resolves.toMatchObject({ total: 1, suggestions: [{ id: 1 }] })
  })

  it('retourne les valeurs par defaut et accepte une date bissextile', async () => {
    const { service } = loadService()
    await expect(service.listSuggestions()).resolves.toEqual({
      suggestions: [],
      total: 0,
      page: 1,
      limit: 20,
    })
    await expect(
      service.listSuggestions({ date_debut: '2028-02-29', date_fin: '2028-02-29' }),
    ).resolves.toMatchObject({ suggestions: [] })
  })

  it('limite la pagination et le total aux suggestions de l auteur authentifie', async () => {
    const { service, fake } = loadService([
      { id: 1, auteur_id: 2, statut: 'terminee', created_at: '2026-10-01T09:00:00.000Z' },
      { id: 2, auteur_id: 99, statut: 'terminee', created_at: '2026-10-01T10:00:00.000Z' },
      { id: 3, auteur_id: 2, statut: 'terminee', created_at: '2026-10-01T11:00:00.000Z' },
      { id: 4, auteur_id: null, statut: 'terminee', created_at: '2026-10-01T12:00:00.000Z' },
      { id: 5, auteur_id: 2, statut: 'nouvelle', created_at: '2026-10-01T13:00:00.000Z' },
      { id: 6, auteur_id: 2, statut: 'terminee', created_at: '2026-10-02T09:00:00.000Z' },
    ])
    const options = {
      auteur_id: '99',
      statut: 'terminee',
      date_debut: '2026-10-01',
      date_fin: '2026-10-01',
      limit: '1',
      ordre: 'asc',
    }

    const firstPage = await service.listOwnSuggestions(2, options)
    const secondPage = await service.listOwnSuggestions(2, { ...options, page: '2' })

    expect(firstPage).toMatchObject({ total: 2, page: 1, limit: 1, suggestions: [{ id: 1 }] })
    expect(secondPage).toMatchObject({ total: 2, page: 2, limit: 1, suggestions: [{ id: 3 }] })
    const authorFilterIndex = fake.calls.findIndex(
      (call) => call.method === 'eq' && call.column === 'auteur_id',
    )
    expect(fake.calls[authorFilterIndex]).toMatchObject({ value: 2 })
    expect(authorFilterIndex).toBeLessThan(fake.calls.findIndex((call) => call.method === 'range'))
    expect(fake.calls).not.toContainEqual(
      expect.objectContaining({ column: 'auteur_id', value: 99 }),
    )
  })

  it('conserve la liste globale sans appliquer un auteur fourni dans les filtres', async () => {
    const { service } = loadService([
      { id: 1, auteur_id: 2, statut: 'terminee', created_at: '2026-10-01T09:00:00.000Z' },
      { id: 2, auteur_id: 99, statut: 'terminee', created_at: '2026-10-01T10:00:00.000Z' },
    ])

    await expect(
      service.listSuggestions({ auteur_id: '2', statut: 'terminee' }),
    ).resolves.toMatchObject({
      total: 2,
      suggestions: [{ id: 2 }, { id: 1 }],
    })
  })

  it.each([
    undefined,
    null,
    0,
    -1,
    '2abc',
    ['2'],
    '2147483648',
  ])('refuse une liste personnelle sans identifiant auteur fiable: %j', async (auteurId) => {
    const { service, fake } = loadService()
    await expect(service.listOwnSuggestions(auteurId)).rejects.toMatchObject({ statusCode: 400 })
    expect(fake.calls).toEqual([])
  })

  it.each([
    { statut: 'publiee' },
    { statut: ['nouvelle'] },
    { date_debut: '2026-02-29' },
    { date_fin: '2026-04-31' },
    { date_debut: '2026-13-01' },
    { date_debut: '2026-10-1' },
    { date_debut: '0000-01-01' },
    { date_debut: ['2026-10-01'] },
    { date_debut: '2026-10-02', date_fin: '2026-10-01' },
    { ordre: 'recent' },
    { ordre: ['desc'] },
    { page: '0' },
    { page: '-1' },
    { page: '1.5' },
    { page: '2abc' },
    { page: '1e2' },
    { page: ['1'] },
    { page: '9007199254740991' },
    { limit: '0' },
    { limit: '101' },
    { limit: null },
  ])('rejette les filtres invalides avant requete: %j', async (options) => {
    const { service, fake } = loadService()
    await expect(service.listSuggestions(options)).rejects.toMatchObject({ statusCode: 400 })
    expect(fake.calls).toEqual([])
  })

  it.each([
    'nouvelle',
    'en_cours',
    'acceptee',
    'refusee',
    'terminee',
  ])('modifie seulement le statut vers %s et sa date', async (statut) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-01T15:00:00.000Z'))
    const original = {
      id: 5,
      titre: 'Titre',
      description: 'Description',
      statut: 'nouvelle',
      auteur_id: 2,
      created_at: '2026-09-30T00:00:00.000Z',
    }
    const { service, fake } = loadService([original])
    const result = await service.updateSuggestionStatus('5', ` ${statut} `)
    expect(result).toEqual({ ...original, statut, updated_at: '2026-10-01T15:00:00.000Z' })
    expect(fake.tables.suggestions[0]).toEqual(result)
  })

  it.each([
    '0',
    '-1',
    '1.5',
    '1abc',
    '2147483648',
    ['1'],
  ])('rejette un identifiant invalide: %j', async (id) => {
    const { service, fake } = loadService()
    await expect(service.updateSuggestionStatus(id, 'acceptee')).rejects.toMatchObject({
      statusCode: 400,
    })
    expect(fake.calls).toEqual([])
  })

  it('signale un statut invalide et une suggestion inexistante', async () => {
    const { service } = loadService()
    await expect(service.updateSuggestionStatus('1', 'publiee')).rejects.toMatchObject({
      statusCode: 400,
    })
    await expect(service.updateSuggestionStatus('1', 'acceptee')).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it.each(['create', 'list', 'update'])('remonte une erreur DB pendant %s', async (operation) => {
    const { service, fake } = loadService()
    const error = { code: 'XX000', message: 'Erreur DB' }
    const originalFrom = fake.client.from
    vi.spyOn(fake.client, 'from').mockImplementation((table) => {
      const query = originalFrom(table)
      query.execute = () => ({ data: null, error })
      return query
    })
    const operationPromise =
      operation === 'create'
        ? service.createSuggestion({ titre: 'Titre', description: 'Description' }, auteur)
        : operation === 'list'
          ? service.listSuggestions()
          : service.updateSuggestionStatus('1', 'acceptee')
    await expect(operationPromise).rejects.toBe(error)
  })
})
