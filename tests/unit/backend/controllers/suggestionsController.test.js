import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase } from '../../helpers/fakeSupabase'
import { loadCjsWithMocks } from '../../helpers/loadCjsWithMocks'
import { invokeRoute } from '../../helpers/routeTestUtils'
import { createLoggerMocks } from './controllerTestUtils'

const restores = []
const dev = { id: 1, nom: 'Developpeur', nom_boutique: 'Support', role: 'dev' }
const existingSuggestion = {
  id: 10,
  titre: 'Titre prive',
  description: 'Description confidentielle',
  statut: 'nouvelle',
  auteur_id: 2,
  auteur_nom: 'Alice',
  auteur_nom_boutique: 'Atelier Alice',
  created_at: '2026-10-01T12:00:00.000Z',
  updated_at: '2026-10-01T12:00:00.000Z',
}

function loadController() {
  const fake = createFakeSupabase({ suggestions: [existingSuggestion] })
  const { loaded: service, restore: restoreService } = loadCjsWithMocks(
    'api/services/suggestionService.cjs',
    { 'api/db.cjs': { getSupabase: () => fake.client } },
  )
  restores.push(restoreService)
  const logger = createLoggerMocks()
  const authMiddleware = vi.fn((req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Non authentifié' })
    next()
  })
  const { loaded: router, restore } = loadCjsWithMocks('api/suggestionsController.cjs', {
    'api/authController.cjs': { authMiddleware },
    'api/services/loggerService.cjs': logger,
    'api/services/suggestionService.cjs': service,
  })
  restores.push(restore)
  return { router, fake, logger }
}

afterEach(() => {
  while (restores.length) restores.pop()()
  vi.restoreAllMocks()
})

describe('suggestionsController', () => {
  it.each([
    'dev',
    'admin',
    'permanent',
    'temporaire',
  ])('autorise un %s authentifie a proposer une idee sans usurper son auteur', async (role) => {
    const { router, fake, logger } = loadController()
    const user = { id: 2, nom: 'Alice', nom_boutique: 'Atelier Alice', role }
    const { res } = await invokeRoute(router, 'post', '/', {
      user,
      body: {
        titre: ' Une idee ',
        description: ' Son contenu ',
        auteur_id: 99,
        auteur_nom: 'Faux auteur',
        statut: 'acceptee',
      },
    })
    expect(res.statusCode).toBe(201)
    expect(res.body.suggestion).toMatchObject({
      titre: 'Une idee',
      description: 'Son contenu',
      auteur_id: 2,
      auteur_nom: 'Alice',
      statut: 'nouvelle',
    })
    expect(fake.tables.suggestions).toHaveLength(2)
    expect(logger.logAction).toHaveBeenCalledWith({
      user,
      action: 'suggestion.create',
      cible_type: 'suggestion',
      cible_id: 11,
      details: { statut: 'nouvelle' },
    })
  })

  it.each([
    'admin',
    'permanent',
    'temporaire',
  ])('refuse au %s la lecture et la modification meme de sa propre idee', async (role) => {
    const { router, fake } = loadController()
    const user = { id: existingSuggestion.auteur_id, role }
    const list = await invokeRoute(router, 'get', '/', { user })
    const update = await invokeRoute(router, 'patch', '/:id/statut', {
      user,
      params: { id: '10' },
      body: { statut: 'acceptee' },
    })
    expect(list.res).toMatchObject({ statusCode: 403 })
    expect(update.res).toMatchObject({ statusCode: 403 })
    expect(JSON.stringify([list.res.body, update.res.body])).not.toContain('Titre prive')
    expect(fake.calls).toEqual([])
  })

  it.each([
    ['post', '/'],
    ['get', '/'],
    ['patch', '/:id/statut'],
  ])('refuse une requete %s %s non authentifiee', async (method, path) => {
    const { router, fake } = loadController()
    const { res } = await invokeRoute(router, method, path)
    expect(res.statusCode).toBe(401)
    expect(fake.calls).toEqual([])
  })

  it('laisse le dev filtrer et traiter une idee sans modifier son contenu', async () => {
    const { router, fake, logger } = loadController()
    const listed = await invokeRoute(router, 'get', '/', {
      user: dev,
      query: {
        statut: 'nouvelle',
        date_debut: '2026-10-01',
        date_fin: '2026-10-01',
        page: '1',
        limit: '10',
        ordre: 'asc',
      },
    })
    expect(listed.res).toMatchObject({
      statusCode: 200,
      body: { suggestions: [existingSuggestion], total: 1, page: 1, limit: 10 },
    })
    const updated = await invokeRoute(router, 'patch', '/:id/statut', {
      user: dev,
      params: { id: '10' },
      body: { statut: 'en_cours', titre: 'Remplacement', auteur_id: 99 },
    })
    expect(updated.res.statusCode).toBe(200)
    expect(updated.res.body.suggestion).toMatchObject({
      ...existingSuggestion,
      statut: 'en_cours',
      updated_at: expect.any(String),
    })
    expect(fake.tables.suggestions[0].titre).toBe(existingSuggestion.titre)
    expect(logger.logAction).toHaveBeenCalledWith({
      user: dev,
      action: 'suggestion.update_status',
      cible_type: 'suggestion',
      cible_id: 10,
      details: { statut: 'en_cours' },
    })
  })

  it.each([
    { method: 'post', path: '/', body: { titre: ' ', description: 'Texte' } },
    { method: 'post', path: '/', body: { titre: 'Titre', description: [] } },
    { method: 'get', path: '/', query: { date_fin: '2026-02-30' } },
    { method: 'get', path: '/', query: { page: '1abc' } },
    { method: 'patch', path: '/:id/statut', params: { id: '10' }, body: { statut: 'invalide' } },
    { method: 'patch', path: '/:id/statut', params: { id: 'abc' }, body: { statut: 'acceptee' } },
  ])('retourne 400 pour une requete invalide: %j', async ({ method, path, ...request }) => {
    const { router, fake, logger } = loadController()
    const { res } = await invokeRoute(router, method, path, { ...request, user: dev })
    expect(res.statusCode).toBe(400)
    expect(fake.calls).toEqual([])
    expect(logger.logAction).not.toHaveBeenCalled()
  })

  it('retourne 404 pour une suggestion absente', async () => {
    const { router } = loadController()
    const { res } = await invokeRoute(router, 'patch', '/:id/statut', {
      user: dev,
      params: { id: '999' },
      body: { statut: 'acceptee' },
    })
    expect(res).toMatchObject({ statusCode: 404, body: { error: 'Suggestion introuvable' } })
  })

  it.each([
    { method: 'post', path: '/', body: { titre: 'Titre prive', description: 'Secret prive' } },
    { method: 'get', path: '/' },
    { method: 'patch', path: '/:id/statut', params: { id: '10' }, body: { statut: 'refusee' } },
  ])('ne divulgue ni contenu ni erreur DB pour $method', async ({ method, path, ...request }) => {
    const { router, fake, logger } = loadController()
    const originalFrom = fake.client.from
    vi.spyOn(fake.client, 'from').mockImplementation((table) => {
      const query = originalFrom(table)
      query.execute = () => ({
        data: null,
        error: { message: 'DB rejected Secret prive', details: 'Titre prive', code: 'XX000' },
      })
      return query
    })
    const { res } = await invokeRoute(router, method, path, {
      ...request,
      user: dev,
      method: method.toUpperCase(),
      originalUrl: '/api/suggestions?contenu=Secret%20prive',
      headers: { 'user-agent': 'Secret prive' },
    })
    expect(res).toMatchObject({ statusCode: 500, body: { error: 'Erreur serveur' } })
    expect(logger.logError).toHaveBeenCalledTimes(1)
    const log = logger.logError.mock.calls[0][0]
    expect(log.err.message).toBe('Erreur de stockage des suggestions')
    expect(JSON.stringify(log)).not.toMatch(/Secret|Titre prive|XX000/)
    expect(logger.logAction).not.toHaveBeenCalled()
  })
})
