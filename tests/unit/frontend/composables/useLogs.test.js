import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../../../src/services/api'

vi.mock('../../../../src/services/api', () => ({
  default: {
    delete: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('alert', vi.fn())
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

import { useLogs } from '../../../../src/composables/useLogs'

describe('useLogs', () => {
  it('charge les logs avec filtres et pagination', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        logs: [{ id: 1, action: 'vente.create' }],
        pagination: { page: 2, limit: 25, total: 30, totalPages: 2 },
      },
    })
    const logs = useLogs()
    logs.logFilters.value = { action: 'vente.create', cible_type: 'vente' }

    await logs.fetchLogs(2)

    expect(api.get).toHaveBeenCalledWith('/api/admin/logs', {
      params: { page: 2, limit: 25, action: 'vente.create', cible_type: 'vente' },
    })
    expect(logs.logs.value).toEqual([{ id: 1, action: 'vente.create' }])
    expect(logs.logsPagination.value.totalPages).toBe(2)
    expect(logs.logsLoading.value).toBe(false)
  })

  it('applique les filtres a la premiere page et ignore les pages invalides', async () => {
    api.get.mockResolvedValue({
      data: {
        logs: [],
        pagination: { page: 1, limit: 25, total: 0, totalPages: 3 },
      },
    })
    const logs = useLogs()
    logs.logsPagination.value.totalPages = 3

    logs.applyLogFilters()
    await vi.waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/api/admin/logs', {
        params: { page: 1, limit: 25 },
      }),
    )

    api.get.mockClear()
    logs.changeLogsPage(0)
    logs.changeLogsPage(4)
    expect(api.get).not.toHaveBeenCalled()

    logs.changeLogsPage(2)
    await vi.waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/api/admin/logs', {
        params: { page: 2, limit: 25 },
      }),
    )
  })

  it('stocke une erreur lisible quand l API logs echoue', async () => {
    api.get.mockRejectedValueOnce({ response: { data: { error: 'Logs KO' } } })
    const logs = useLogs()

    await logs.fetchLogs()

    expect(logs.logsError.value).toBe('Logs KO')
    expect(logs.logsLoading.value).toBe(false)
  })
})
