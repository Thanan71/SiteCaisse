import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../src/services/api'
import { useArtisansStore } from '../../src/store/artisans'
import { useAuthStore } from '../../src/store/auth'
import { useRapportsStore } from '../../src/store/rapports'
import { useVentesStore } from '../../src/store/ventes'

vi.mock('../../src/services/api', () => ({
  default: {
    delete: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}))

function installLocalStorage(initialValues = {}) {
  const store = new Map(Object.entries(initialValues))

  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key) => (store.has(key) ? store.get(key) : null)),
    setItem: vi.fn((key, value) => store.set(key, String(value))),
    removeItem: vi.fn((key) => store.delete(key)),
    clear: vi.fn(() => store.clear()),
  })

  return store
}

describe('Pinia stores', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    installLocalStorage()
  })

  describe('auth store', () => {
    it('connecte, persiste puis deconnecte un utilisateur', async () => {
      api.post.mockResolvedValueOnce({
        data: {
          token: 'token-123',
          password_change_required: true,
          user: { id: 1, nom: 'Admin', role: 'admin' },
        },
      })

      const store = useAuthStore()
      const result = await store.login('Administration', 'password123')

      expect(api.post).toHaveBeenCalledWith('/api/auth/login', {
        nom_boutique: 'Administration',
        password: 'password123',
      })
      expect(result.password_change_required).toBe(true)
      expect(store.isAuthenticated).toBe(true)
      expect(store.isAdmin).toBe(true)
      expect(localStorage.setItem).toHaveBeenCalledWith('token', 'token-123')

      store.logout()

      expect(store.token).toBe('')
      expect(store.user).toBeNull()
      expect(localStorage.removeItem).toHaveBeenCalledWith('token')
      expect(localStorage.removeItem).toHaveBeenCalledWith('user')
    })

    it('rafraichit le profil ou deconnecte si /me echoue', async () => {
      const store = useAuthStore()
      store.token = 'token'
      store.user = { id: 1, nom: 'Ancien', role: 'permanent' }
      api.get.mockResolvedValueOnce({ data: { id: 1, nom: 'Nouveau', role: 'permanent' } })

      await store.fetchUser()

      expect(store.userName).toBe('Nouveau')

      api.get.mockRejectedValueOnce({ response: { status: 401 } })
      await expect(store.fetchUser()).rejects.toEqual({ response: { status: 401 } })
      expect(store.isAuthenticated).toBe(false)
    })

    it('change le mot de passe et nettoie le flag local', async () => {
      const store = useAuthStore()
      store.user = { id: 1, password_change_required: true }
      api.post.mockResolvedValueOnce({ data: { message: 'ok' } })

      await expect(store.changePassword('nouveau')).resolves.toEqual({ message: 'ok' })

      expect(api.post).toHaveBeenCalledWith('/api/auth/change-password', {
        newPassword: 'nouveau',
      })
      expect(store.user.password_change_required).toBe(false)
    })
  })

  describe('ventes store', () => {
    it('charge les ventes avec pagination et filtres actifs', async () => {
      api.get.mockResolvedValueOnce({
        data: {
          ventes: [{ id: 1 }],
          pagination: { page: 2, limit: 20, total: 41, totalPages: 3 },
        },
      })
      const store = useVentesStore()
      store.filters.type_paiement = 'CB'

      await store.fetchVentes({ page: 2, limit: 20, date_debut: '2026-07-01' })

      expect(api.get).toHaveBeenCalledWith('/api/ventes', {
        params: {
          page: 2,
          limit: 20,
          date_debut: '2026-07-01',
          type_paiement: 'CB',
        },
      })
      expect(store.ventes).toEqual([{ id: 1 }])
      expect(store.hasPrevPage).toBe(true)
      expect(store.hasNextPage).toBe(true)
      expect(store.hasActiveFilters).toBe(true)
    })

    it('applique, reinitialise les filtres et protege les pages invalides', async () => {
      api.get.mockResolvedValue({
        data: {
          ventes: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        },
      })
      const store = useVentesStore()

      await store.applyFilters({ type_paiement: 'Cheque' })
      expect(store.filters.type_paiement).toBe('Cheque')

      await store.resetFilters()
      expect(store.filters).toEqual({ date_debut: '', date_fin: '', type_paiement: '' })

      api.get.mockClear()
      store.pagination = { page: 1, limit: 10, total: 10, totalPages: 1 }
      await store.goToPage(2)
      await store.prevPage()
      await store.nextPage()
      expect(api.get).not.toHaveBeenCalled()
    })

    it('ajoute, modifie et supprime une vente puis recharge la liste', async () => {
      api.post.mockResolvedValueOnce({ data: { id: 1 } })
      api.put.mockResolvedValueOnce({ data: { message: 'ok' } })
      api.delete.mockResolvedValueOnce({ data: { message: 'ok' } })
      api.get.mockResolvedValue({
        data: {
          ventes: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        },
      })
      const store = useVentesStore()

      await store.addVente({ articles: [] })
      await store.updateVente(1, { type_paiement: 'CB' })
      await store.deleteVente(1)

      expect(api.post).toHaveBeenCalledWith('/api/ventes', { articles: [] })
      expect(api.put).toHaveBeenCalledWith('/api/ventes/1', { type_paiement: 'CB' })
      expect(api.delete).toHaveBeenCalledWith('/api/ventes/1')
      expect(api.get).toHaveBeenCalledTimes(3)
    })

    it('expose le message API en cas d erreur', async () => {
      api.get.mockRejectedValueOnce({ response: { data: { error: 'Boom ventes' } } })
      const store = useVentesStore()

      await expect(store.fetchVentes()).rejects.toEqual({
        response: { data: { error: 'Boom ventes' } },
      })
      expect(store.error).toBe('Boom ventes')
      expect(store.loading).toBe(false)
    })
  })

  describe('artisans store', () => {
    it('charge les artisans et expose les getters', async () => {
      api.get.mockResolvedValueOnce({
        data: [
          { id: 1, nom: 'Alice', nom_boutique: 'Atelier Alice', role: 'permanent' },
          { id: 2, nom: 'Bob', role: 'temporaire', est_actif: false },
        ],
      })
      const store = useArtisansStore()

      await store.fetchArtisans({ includeInactive: true })

      expect(api.get).toHaveBeenCalledWith('/api/rapports/artisans', {
        params: { include_inactive: 'true' },
      })
      expect(store.actifs).toHaveLength(1)
      expect(store.permanents).toHaveLength(1)
      expect(store.temporaires).toHaveLength(1)
      expect(store.getArtisanName(1)).toBe('Atelier Alice')
      expect(store.getArtisanName(999)).toBe('Artisan inconnu')
    })
  })

  describe('rapports store', () => {
    it('charge les rapports globaux, artisan et mensuel', async () => {
      api.get
        .mockResolvedValueOnce({
          data: {
            groupes: [{ artisan_id: 1 }],
            total: { total_articles: 2 },
            parametres: { commission_cb_permanent: 1.5 },
          },
        })
        .mockResolvedValueOnce({
          data: {
            ventes: [{ id: 1 }],
            summary: { total_articles: 1, total_montant: 10 },
          },
        })
        .mockResolvedValueOnce({
          data: {
            groupes: [{ artisan_id: 1 }],
            total: { total_articles: 1 },
          },
        })
      const store = useRapportsStore()

      await store.fetchAllRapports()
      await store.fetchVentesByArtisan(1)
      await store.fetchRapportByMonth('2026-07')

      expect(store.allRapports).toEqual([{ artisan_id: 1 }])
      expect(store.totalGlobal).toEqual({ total_articles: 2 })
      expect(store.totalAllParams).toEqual({ commission_cb_permanent: 1.5 })
      expect(store.selectedArtisanId).toBe(1)
      expect(store.ventesArtisan).toEqual([{ id: 1 }])
      expect(store.rapportMois.total).toEqual({ total_articles: 1 })
    })

    it('remonte une erreur de chargement de rapport', async () => {
      api.get.mockRejectedValueOnce({ response: { data: { error: 'Rapport KO' } } })
      const store = useRapportsStore()

      await expect(store.fetchAllRapports()).rejects.toEqual({
        response: { data: { error: 'Rapport KO' } },
      })
      expect(store.error).toBe('Rapport KO')
    })
  })
})
