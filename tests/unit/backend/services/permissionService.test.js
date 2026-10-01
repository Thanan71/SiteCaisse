import express from 'express'
import { describe, expect, it } from 'vitest'
import permissions from '../../../../api/services/permissionService.cjs'
import { invokeRoute } from '../../helpers/routeTestUtils'

describe('permissionService', () => {
  it.each([
    ['dev', true, true],
    ['admin', true, false],
    ['permanent', false, false],
    ['temporaire', false, false],
    ['inconnu', false, false],
    [undefined, false, false],
  ])('controle le role %s sur les routes admin et dev', async (role, adminAllowed, devAllowed) => {
    const router = express.Router()
    const handler = (_req, res) => res.json({ ok: true })
    router.get('/admin', permissions.requireAdmin, handler)
    router.get('/dev', permissions.requireDev, handler)
    const user = role ? { id: 1, role } : undefined

    expect(permissions.isAdminRole(role)).toBe(adminAllowed)
    await expect(invokeRoute(router, 'get', '/admin', { user })).resolves.toMatchObject({
      res: { statusCode: adminAllowed ? 200 : 403 },
    })
    await expect(invokeRoute(router, 'get', '/dev', { user })).resolves.toMatchObject({
      res: { statusCode: devAllowed ? 200 : 403 },
    })
  })
})
