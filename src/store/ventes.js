/**
 * @module store/ventes
 * @description Store Pinia de gestion des ventes.
 * Fournit les actions CRUD (Create, Read, Update, Delete) pour les ventes
 * avec gestion des états de chargement et d'erreur.
 * Prend en charge la pagination et les filtres avancés.
 */
import { defineStore } from 'pinia'
import api from '../services/api'

export const useVentesStore = defineStore('ventes', {
  state: () => ({
    /** @property {Array} ventes - Liste des ventes de la page courante. */
    ventes: [],
    /** @property {boolean} loading - Indicateur de chargement. */
    loading: false,
    /** @property {string|null} error - Message d'erreur éventuel. */
    error: null,
    /** @property {Object} pagination - Informations de pagination. */
    pagination: {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
    },
    /** @property {Object} filters - Filtres actifs. */
    filters: {
      date_debut: '',
      date_fin: '',
      type_paiement: '',
    },
  }),

  getters: {
    /**
     * Retourne le nombre total de ventes.
     * @returns {number} Nombre total de ventes (toutes pages confondues).
     */
    totalVentes: (state) => state.pagination.total,
    /**
     * Vérifie s'il y a une page suivante.
     * @returns {boolean}
     */
    hasNextPage: (state) => state.pagination.page < state.pagination.totalPages,
    /**
     * Vérifie s'il y a une page précédente.
     * @returns {boolean}
     */
    hasPrevPage: (state) => state.pagination.page > 1,
    /**
     * Vérifie si des filtres sont actifs.
     * @returns {boolean}
     */
    hasActiveFilters: (state) =>
      !!state.filters.date_debut || !!state.filters.date_fin || !!state.filters.type_paiement,
  },

  actions: {
    /**
     * Récupère les ventes depuis l'API avec pagination et filtres.
     * Met à jour la liste et gère les états de chargement et d'erreur.
     * @param {Object} [options] - Options de pagination/filtres.
     * @param {number} [options.page] - Numéro de la page.
     * @param {number} [options.limit] - Nombre d'éléments par page.
     * @param {string} [options.date_debut] - Filtre date début.
     * @param {string} [options.date_fin] - Filtre date fin.
     * @param {string} [options.type_paiement] - Filtre type de paiement.
     * @returns {Promise<void>}
     */
    async fetchVentes(options = {}) {
      this.loading = true
      this.error = null
      try {
        const params = {}

        // Appliquer les options fournies ou les valeurs par défaut
        params.page = options.page || this.pagination.page
        params.limit = options.limit || this.pagination.limit

        // Fusionner les filtres
        const filters = { ...this.filters, ...options }
        if (filters.date_debut) params.date_debut = filters.date_debut
        if (filters.date_fin) params.date_fin = filters.date_fin
        if (filters.type_paiement) params.type_paiement = filters.type_paiement

        const response = await api.get('/api/ventes', { params })
        this.ventes = response.data.ventes
        this.pagination = response.data.pagination
      } catch (error) {
        this.error = error.response?.data?.error || 'Erreur lors du chargement des ventes'
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Change la page courante.
     * @param {number} page - Numéro de la page.
     * @returns {Promise<void>}
     */
    async goToPage(page) {
      if (page < 1 || page > this.pagination.totalPages) return
      await this.fetchVentes({ page })
    },

    /**
     * Va à la page suivante.
     * @returns {Promise<void>}
     */
    async nextPage() {
      if (this.hasNextPage) {
        await this.goToPage(this.pagination.page + 1)
      }
    },

    /**
     * Va à la page précédente.
     * @returns {Promise<void>}
     */
    async prevPage() {
      if (this.hasPrevPage) {
        await this.goToPage(this.pagination.page - 1)
      }
    },

    /**
     * Applique des filtres et recharge la page 1.
     * @param {Object} filters - Filtres à appliquer.
     * @returns {Promise<void>}
     */
    async applyFilters(filters) {
      this.filters = { ...this.filters, ...filters }
      await this.fetchVentes({ page: 1, ...this.filters })
    },

    /**
     * Réinitialise les filtres.
     * @returns {Promise<void>}
     */
    async resetFilters() {
      this.filters = { date_debut: '', date_fin: '', type_paiement: '' }
      await this.fetchVentes({ page: 1 })
    },

    /**
     * Ajoute une nouvelle vente et rafraîchit la liste.
     * @param {Object} data - Données de la vente à créer.
     * @returns {Promise<void>}
     */
    async addVente(data) {
      this.loading = true
      this.error = null
      try {
        await api.post('/api/ventes', data)
        await this.fetchVentes({ page: 1 })
      } catch (error) {
        this.error = error.response?.data?.error || "Erreur lors de l'ajout de la vente"
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Modifie une vente existante et rafraîchit la liste.
     * @param {number} id - ID de la vente à modifier.
     * @param {Object} data - Champs à modifier.
     * @returns {Promise<void>}
     */
    async updateVente(id, data) {
      this.loading = true
      this.error = null
      try {
        await api.put(`/api/ventes/${id}`, data)
        await this.fetchVentes()
      } catch (error) {
        this.error = error.response?.data?.error || 'Erreur lors de la modification'
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Supprime une vente et rafraîchit la liste.
     * @param {number} id - ID de la vente à supprimer.
     * @returns {Promise<void>}
     */
    async deleteVente(id) {
      this.loading = true
      this.error = null
      try {
        await api.delete(`/api/ventes/${id}`)
        await this.fetchVentes()
      } catch (error) {
        this.error = error.response?.data?.error || 'Erreur lors de la suppression'
        throw error
      } finally {
        this.loading = false
      }
    },
  },
})
