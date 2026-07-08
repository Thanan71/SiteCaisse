import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase } from '../../helpers/fakeSupabase'
import { loadCjsWithMocks } from '../../helpers/loadCjsWithMocks'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('loggerService', () => {
  it('journalise une action avec utilisateur, IP et user agent', async () => {
    const fake = createFakeSupabase({ action_logs: [] })
    const { loaded, restore } = loadCjsWithMocks('api/services/loggerService.cjs', {
      'api/db.cjs': { getSupabase: () => fake.client },
    })

    await loaded.logAction({
      user: { id: 1, nom: 'Admin', nom_boutique: 'Administration' },
      action: 'vente.create',
      cible_type: 'vente',
      cible_id: 123,
      details: { type_paiement: 'CB' },
      req: {
        headers: {
          'x-forwarded-for': '203.0.113.1, 10.0.0.1',
          'user-agent': 'Vitest',
        },
      },
    })

    expect(fake.tables.action_logs[0]).toMatchObject({
      user_id: 1,
      user_nom: 'Admin',
      user_nom_boutique: 'Administration',
      action: 'vente.create',
      cible_type: 'vente',
      cible_id: '123',
      details: { type_paiement: 'CB' },
      ip_address: '203.0.113.1',
      user_agent: 'Vitest',
    })

    restore()
  })

  it('ignore une action vide et journalise les erreurs formatees', async () => {
    const fake = createFakeSupabase({ action_logs: [] })
    const { loaded, restore } = loadCjsWithMocks('api/services/loggerService.cjs', {
      'api/db.cjs': { getSupabase: () => fake.client },
    })

    await loaded.logAction({ action: '' })
    await loaded.logError({
      err: Object.assign(new Error('Explosion'), { code: 'E_TEST', statusCode: 418 }),
      context: 'tests.backend',
      req: { method: 'POST', originalUrl: '/api/test', headers: {} },
    })

    expect(fake.tables.action_logs).toHaveLength(1)
    expect(fake.tables.action_logs[0]).toMatchObject({
      action: 'error',
      cible_type: 'error',
      details: {
        context: 'tests.backend',
        method: 'POST',
        path: '/api/test',
        name: 'Error',
        message: 'Explosion',
        code: 'E_TEST',
        status: 418,
      },
    })

    restore()
  })

  it('pagine et filtre les logs', async () => {
    const fake = createFakeSupabase({
      action_logs: [
        {
          id: 1,
          action: 'vente.create',
          cible_type: 'vente',
          created_at: '2026-07-06T10:00:00Z',
        },
        {
          id: 2,
          action: 'vente.delete',
          cible_type: 'vente',
          created_at: '2026-07-07T10:00:00Z',
        },
        {
          id: 3,
          action: 'auth.login_success',
          cible_type: 'auth',
          created_at: '2026-07-08T10:00:00Z',
        },
      ],
    })
    const { loaded, restore } = loadCjsWithMocks('api/services/loggerService.cjs', {
      'api/db.cjs': { getSupabase: () => fake.client },
    })

    const result = await loaded.getActionLogs({
      page: '1',
      limit: '1',
      cible_type: 'vente',
    })

    expect(result.logs).toEqual([
      expect.objectContaining({
        id: 2,
        action: 'vente.delete',
      }),
    ])
    expect(result.pagination).toEqual({
      page: 1,
      limit: 1,
      total: 2,
      totalPages: 2,
    })

    restore()
  })
})
