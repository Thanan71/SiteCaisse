import express from 'express'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadCjsWithMocks } from '../../helpers/loadCjsWithMocks'

describe('api index', () => {
  const previousVercel = process.env.VERCEL

  afterEach(() => {
    if (previousVercel === undefined) {
      delete process.env.VERCEL
    } else {
      process.env.VERCEL = previousVercel
    }
  })

  it('configure l application Express sans demarrer de serveur en environnement Vercel', () => {
    process.env.VERCEL = '1'
    const authRouter = express.Router()
    const ventesRouter = express.Router()
    const rapportsRouter = express.Router()
    const adminRouter = express.Router()
    const seedAdminIfMissing = vi.fn(async () => {})

    const { loaded: app, restore } = loadCjsWithMocks('api/index.cjs', {
      'api/adminController.cjs': adminRouter,
      'api/authController.cjs': { router: authRouter },
      'api/models.cjs': { seedAdminIfMissing },
      'api/rapportsController.cjs': rapportsRouter,
      'api/ventesController.cjs': ventesRouter,
    })

    expect(seedAdminIfMissing).toHaveBeenCalledTimes(1)
    expect(app.handle).toEqual(expect.any(Function))

    const mountedRouters = app._router.stack
      .filter((layer) => layer.name === 'router')
      .map((layer) => String(layer.regexp))

    expect(mountedRouters).toEqual(
      expect.arrayContaining([
        expect.stringContaining('\\/api\\/auth'),
        expect.stringContaining('\\/api\\/ventes'),
        expect.stringContaining('\\/api\\/rapports'),
        expect.stringContaining('\\/api\\/admin'),
      ]),
    )

    restore()
  })
})
