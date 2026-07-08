import crypto from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase } from './helpers/fakeSupabase'
import { loadCjsWithMocks } from './helpers/loadCjsWithMocks'

describe('backend services', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('parametresService', () => {
    it('retourne les parametres sous forme cle valeur', async () => {
      const fake = createFakeSupabase({
        parametres: [
          { cle: 'commission_cb_permanent', valeur: '1.5', description: 'Permanent' },
          { cle: 'commission_cb_temporaire', valeur: '2.5', description: 'Temporaire' },
        ],
      })
      const { loaded, restore } = loadCjsWithMocks('api/services/parametresService.cjs', {
        'api/db.cjs': { getSupabase: () => fake.client },
      })

      await expect(loaded.getAllParametres()).resolves.toEqual({
        commission_cb_permanent: '1.5',
        commission_cb_temporaire: '2.5',
      })

      restore()
    })

    it('met a jour un parametre existant ou cree une nouvelle cle', async () => {
      const fake = createFakeSupabase({
        parametres: [{ cle: 'commission_cb_permanent', valeur: '1.5' }],
      })
      const { loaded, restore } = loadCjsWithMocks('api/services/parametresService.cjs', {
        'api/db.cjs': { getSupabase: () => fake.client },
      })

      await expect(loaded.updateParametre('commission_cb_permanent', '1.75')).resolves.toBe(true)
      await expect(loaded.updateParametre('nouveau_parametre', '42', 'Demo')).resolves.toBe(true)

      expect(fake.tables.parametres).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ cle: 'commission_cb_permanent', valeur: '1.75' }),
          expect.objectContaining({
            cle: 'nouveau_parametre',
            valeur: '42',
            description: 'Demo',
          }),
        ]),
      )

      restore()
    })
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

  describe('adminUserService', () => {
    beforeEach(() => {
      vi.spyOn(crypto, 'randomInt').mockReturnValue(42)
    })

    function loadAdminService(fake, modelMocks = {}) {
      return loadCjsWithMocks('api/services/adminUserService.cjs', {
        'api/db.cjs': { getSupabase: () => fake.client },
        'api/models.cjs': {
          extendUserDateFin: vi.fn(),
          resetUserPassword: vi.fn(async (_userId, password) => password),
          ...modelMocks,
        },
      })
    }

    it('cree un utilisateur avec mot de passe normalise et changement obligatoire', async () => {
      const fake = createFakeSupabase({ users: [] })
      const { loaded, restore } = loadAdminService(fake)

      const result = await loaded.createUser({
        nom: 'Zoe',
        nom_boutique: 'Atelier Zoé !',
        role: 'temporaire',
        date_fin: '2026-08-01',
      })

      expect(result.newPassword).toBe('atelierzoe0042')
      expect(result.user).toMatchObject({
        id: 1,
        nom: 'Zoe',
        nom_boutique: 'Atelier Zoé !',
        generated_password: 'atelierzoe0042',
        role: 'temporaire',
        password_change_required: true,
        date_fin: '2026-08-01',
      })
      expect(fake.tables.users[0].password_hash).not.toBe('atelierzoe0042')

      restore()
    })

    it('refuse un nom de boutique deja existant', async () => {
      const fake = createFakeSupabase({
        users: [{ id: 1, nom_boutique: 'Atelier Alice' }],
      })
      const { loaded, restore } = loadAdminService(fake)

      await expect(
        loaded.createUser({
          nom: 'Alice',
          nom_boutique: 'Atelier Alice',
          role: 'permanent',
        }),
      ).rejects.toMatchObject({
        name: 'AdminUserError',
        statusCode: 409,
        code: 'DUPLICATE_SHOP',
      })

      restore()
    })

    it('desactive, reactive et protege les cas interdits', async () => {
      const fake = createFakeSupabase({
        users: [
          { id: 1, nom: 'Admin', nom_boutique: 'Admin', role: 'admin', est_actif: true },
          {
            id: 2,
            nom: 'Alice',
            nom_boutique: 'Atelier Alice',
            role: 'permanent',
            est_actif: true,
          },
          { id: 3, nom: 'Bob', nom_boutique: 'Atelier Bob', role: 'permanent', est_actif: false },
        ],
      })
      const { loaded, restore } = loadAdminService(fake)

      await expect(loaded.deactivateUser(2, 2)).rejects.toMatchObject({ code: 'SELF_DELETE' })
      await expect(loaded.deactivateUser(1, 99)).rejects.toMatchObject({
        code: 'ADMIN_DEACTIVATE',
      })

      await expect(loaded.deactivateUser(2, 99)).resolves.toMatchObject({
        id: 2,
        est_actif: false,
      })
      await expect(loaded.reactivateUser(3)).resolves.toMatchObject({
        id: 3,
        est_actif: true,
      })
      await expect(loaded.reactivateUser(999)).rejects.toMatchObject({ code: 'USER_NOT_FOUND' })

      restore()
    })

    it('met a jour, retire et valide les commissions personnalisees', async () => {
      const fake = createFakeSupabase({
        users: [
          {
            id: 1,
            nom: 'Admin',
            nom_boutique: 'Admin',
            role: 'admin',
            commission_cb_personnalisee: null,
          },
          {
            id: 2,
            nom: 'Alice',
            nom_boutique: 'Atelier Alice',
            role: 'permanent',
            commission_cb_personnalisee: null,
          },
        ],
      })
      const { loaded, restore } = loadAdminService(fake)

      await expect(loaded.updateUserCommission(2, '2,50')).resolves.toMatchObject({
        previousUser: expect.objectContaining({ commission_cb_personnalisee: null }),
        user: expect.objectContaining({ commission_cb_personnalisee: 2.5 }),
      })
      await expect(loaded.updateUserCommission(2, '')).resolves.toMatchObject({
        user: expect.objectContaining({ commission_cb_personnalisee: null }),
      })
      await expect(loaded.updateUserCommission(2, '-1')).rejects.toMatchObject({
        code: 'INVALID_COMMISSION',
      })
      await expect(loaded.updateUserCommission(1, '1')).rejects.toMatchObject({
        code: 'ADMIN_COMMISSION',
      })

      restore()
    })

    it('reinitialise le mot de passe avec un mot de passe genere', async () => {
      const resetUserPassword = vi.fn(async (_userId, password) => password)
      const fake = createFakeSupabase({
        users: [{ id: 2, nom: 'Alice', nom_boutique: 'Atelier Alice', role: 'permanent' }],
      })
      const { loaded, restore } = loadAdminService(fake, { resetUserPassword })

      const result = await loaded.resetPasswordForUser(2)

      expect(resetUserPassword).toHaveBeenCalledWith(2, 'atelieralice0042')
      expect(result).toEqual({
        user: { id: 2, nom: 'Alice', nom_boutique: 'Atelier Alice', role: 'permanent' },
        newPassword: 'atelieralice0042',
      })

      restore()
    })

    it('prolonge uniquement les utilisateurs temporaires avec une date posterieure', async () => {
      const extendUserDateFin = vi.fn(async () => true)
      const fake = createFakeSupabase({
        users: [
          { id: 2, nom: 'Alice', role: 'permanent', date_fin: null },
          { id: 3, nom: 'Temp', role: 'temporaire', date_fin: '2026-07-31' },
        ],
      })
      const { loaded, restore } = loadAdminService(fake, { extendUserDateFin })

      await expect(loaded.extendTemporaryUserAccess(3, '')).rejects.toMatchObject({
        code: 'MISSING_END_DATE',
      })
      await expect(loaded.extendTemporaryUserAccess(2, '2026-08-31')).rejects.toMatchObject({
        code: 'NOT_TEMPORARY',
      })
      await expect(loaded.extendTemporaryUserAccess(3, '2026-07-15')).rejects.toMatchObject({
        code: 'END_DATE_NOT_AFTER_CURRENT',
      })
      await expect(loaded.extendTemporaryUserAccess(3, '2026-08-31')).resolves.toMatchObject({
        user: expect.objectContaining({ id: 3 }),
        nouvelleDateFin: '2026-08-31',
      })
      expect(extendUserDateFin).toHaveBeenCalledWith(3, '2026-08-31')

      restore()
    })
  })

  describe('rapportService', () => {
    function loadRapportService(models, parametres = {}) {
      return loadCjsWithMocks('api/services/rapportService.cjs', {
        'api/models.cjs': models,
        'api/services/parametresService.cjs': {
          getAllParametres: vi.fn(async () => ({
            commission_cb_permanent: '1.5',
            commission_cb_temporaire: '2.5',
            ...parametres,
          })),
        },
      })
    }

    const groupedData = {
      groupes: [
        {
          artisan_id: 1,
          artisan_role: 'permanent',
          ventes: [{ type_paiement: 'CB', articles: [{ prix: 100, quantite: 1 }] }],
          summary: { total_articles: 1, total_montant: 100 },
        },
        {
          artisan_id: 2,
          artisan_role: 'temporaire',
          ventes: [{ type_paiement: 'CB', articles: [{ prix: 50, quantite: 2 }] }],
          summary: { total_articles: 2, total_montant: 100 },
        },
      ],
      total: { total_articles: 3, total_montant: 200 },
    }

    it('enrichit le rapport global avec les commissions', async () => {
      const { loaded, restore } = loadRapportService({
        getAllVentesGroupedByArtisan: vi.fn(async () => groupedData),
      })

      const result = await loaded.getRapportGlobal()

      expect(result.total).toEqual({
        total_articles: 3,
        total_montant: 200,
        total_cb: 200,
        total_commission: 4,
      })
      expect(result.groupes[0].summary.commission_cb).toBe(1.5)
      expect(result.groupes[1].summary.commission_cb).toBe(2.5)
      expect(result.parametres).toEqual({
        commission_cb_permanent: 1.5,
        commission_cb_temporaire: 2.5,
      })

      restore()
    })

    it('enrichit les rapports mensuels et par mois', async () => {
      const models = {
        getAllVentesGroupedByMonth: vi.fn(async () => ({
          mois: [{ mois: '2026-07', ...groupedData }],
          total: { total_articles: 3, total_montant: 200 },
        })),
        getVentesByMonth: vi.fn(async () => groupedData),
      }
      const { loaded, restore } = loadRapportService(models)

      const mensuel = await loaded.getRapportMensuel()
      const juillet = await loaded.getRapportParMois('2026-07')

      expect(mensuel.mois[0].total).toMatchObject({
        total_cb: 200,
        total_commission: 4,
      })
      expect(juillet.total).toMatchObject({
        total_cb: 200,
        total_commission: 4,
      })
      expect(models.getVentesByMonth).toHaveBeenCalledWith('2026-07')

      restore()
    })

    it('applique la commission personnalisee sur un rapport artisan', async () => {
      const { loaded, restore } = loadRapportService({
        getVentesByArtisan: vi.fn(async () => ({
          ventes: [{ type_paiement: 'CB', articles: [{ prix: 100, quantite: 1 }] }],
          summary: { total_articles: 1, total_montant: 100 },
        })),
        getAllArtisans: vi.fn(async () => [
          {
            id: 2,
            role: 'temporaire',
            commission_cb_personnalisee: 3,
          },
        ]),
      })

      const result = await loaded.getRapportArtisan(2)

      expect(result.summary).toMatchObject({
        total_cb: 100,
        commission_cb: 3,
        taux_commission: 3,
        commission_personnalisee: true,
      })

      restore()
    })
  })
})
