import { vi } from 'vitest'
import { loadCjsWithMocks } from '../../helpers/loadCjsWithMocks'

export const JWT_SECRET = 'sitecaisse-secret-key-2024'
export const adminUser = { id: 1, nom: 'Admin', nom_boutique: 'Administration', role: 'admin' }
export const artisanUser = {
  id: 2,
  nom: 'Alice',
  nom_boutique: 'Atelier Alice',
  role: 'permanent',
}

export class AdminUserError extends Error {
  constructor(message, statusCode = 400) {
    super(message)
    this.name = 'AdminUserError'
    this.statusCode = statusCode
  }
}

export function createAuthMiddleware(defaultUser = adminUser) {
  return vi.fn((req, _res, next) => {
    req.user ??= { ...defaultUser }
    next()
  })
}

export function createLoggerMocks(overrides = {}) {
  return {
    getActionLogs: vi.fn(async () => ({ logs: [], pagination: { page: 1 } })),
    logAction: vi.fn(async () => {}),
    logError: vi.fn(async () => {}),
    ...overrides,
  }
}

export function loadAuthController(modelOverrides = {}) {
  const models = {
    findUserById: vi.fn(),
    findUserByNomBoutique: vi.fn(),
    updatePassword: vi.fn(async () => true),
    ...modelOverrides,
  }
  const logger = createLoggerMocks()
  const { loaded, restore } = loadCjsWithMocks('api/authController.cjs', {
    'api/models.cjs': models,
    'api/services/loggerService.cjs': logger,
  })

  return { router: loaded.router, authMiddleware: loaded.authMiddleware, models, logger, restore }
}

export function loadVentesController(modelOverrides = {}) {
  const authMiddleware = createAuthMiddleware(artisanUser)
  const models = {
    createVente: vi.fn(async () => 42),
    deleteVente: vi.fn(async () => true),
    getAllVentes: vi.fn(async () => ({ ventes: [], pagination: { page: 1 } })),
    updateVente: vi.fn(async () => true),
    ...modelOverrides,
  }
  const logger = createLoggerMocks()
  const { loaded, restore } = loadCjsWithMocks('api/ventesController.cjs', {
    'api/authController.cjs': { authMiddleware },
    'api/models.cjs': models,
    'api/services/loggerService.cjs': logger,
  })

  return { router: loaded, authMiddleware, models, logger, restore }
}

export function loadRapportsController(serviceOverrides = {}, modelOverrides = {}) {
  const authMiddleware = createAuthMiddleware(artisanUser)
  const models = {
    getAllArtisans: vi.fn(async () => [artisanUser]),
    ...modelOverrides,
  }
  const rapportService = {
    getRapportArtisan: vi.fn(async () => ({ ventes: [], summary: {} })),
    getRapportGlobal: vi.fn(async () => ({ groupes: [], total: {} })),
    getRapportMensuel: vi.fn(async () => ({ mois: [], total: {} })),
    getRapportParMois: vi.fn(async () => ({ groupes: [], total: {} })),
    ...serviceOverrides,
  }
  const logger = createLoggerMocks()
  const { loaded, restore } = loadCjsWithMocks('api/rapportsController.cjs', {
    'api/authController.cjs': { authMiddleware },
    'api/models.cjs': models,
    'api/services/loggerService.cjs': logger,
    'api/services/rapportService.cjs': rapportService,
  })

  return { router: loaded, authMiddleware, models, rapportService, logger, restore }
}

export function loadAdminController(
  serviceOverrides = {},
  parametreOverrides = {},
  loggerOverrides = {},
) {
  const authMiddleware = createAuthMiddleware(adminUser)
  const adminService = {
    AdminUserError,
    createUser: vi.fn(async () => ({
      newPassword: 'atelier1234',
      user: { id: 3, nom: 'Zoe', nom_boutique: 'Atelier Zoe', role: 'permanent' },
    })),
    deactivateUser: vi.fn(async () => ({
      id: 3,
      nom: 'Zoe',
      nom_boutique: 'Atelier Zoe',
      role: 'permanent',
    })),
    extendTemporaryUserAccess: vi.fn(async () => ({
      nouvelleDateFin: '2026-08-31',
      user: { id: 4, nom: 'Tom', nom_boutique: 'Boutique Tom', date_fin: '2026-07-31' },
    })),
    listUsers: vi.fn(async () => [adminUser]),
    reactivateUser: vi.fn(async () => ({
      id: 3,
      nom: 'Zoe',
      nom_boutique: 'Atelier Zoe',
      role: 'permanent',
    })),
    resetPasswordForUser: vi.fn(async () => ({
      newPassword: 'reset1234',
      user: { id: 3, nom: 'Zoe', nom_boutique: 'Atelier Zoe' },
    })),
    updateUserCommission: vi.fn(async () => ({
      previousUser: {
        nom: 'Zoe',
        nom_boutique: 'Atelier Zoe',
        commission_cb_personnalisee: null,
      },
      user: {
        id: 3,
        nom: 'Zoe',
        nom_boutique: 'Atelier Zoe',
        commission_cb_personnalisee: 1.5,
      },
    })),
    ...serviceOverrides,
  }
  const parametres = {
    getAllParametres: vi.fn(async () => ({ commission_cb_permanent: '1.5' })),
    updateParametre: vi.fn(async () => true),
    ...parametreOverrides,
  }
  const logger = createLoggerMocks(loggerOverrides)
  const { loaded, restore } = loadCjsWithMocks('api/adminController.cjs', {
    'api/authController.cjs': { authMiddleware },
    'api/services/adminUserService.cjs': adminService,
    'api/services/loggerService.cjs': logger,
    'api/services/parametresService.cjs': parametres,
  })

  return { router: loaded, authMiddleware, adminService, parametres, logger, restore }
}
