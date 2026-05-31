/**
 * @module store/ventes
 * @description Store Pinia de gestion des ventes.
 * Fournit les actions CRUD (Create, Read, Update, Delete) pour les ventes
 * avec gestion des états de chargement et d'erreur.
 */
import { defineStore } from 'pinia'
import api from '../services/api'

export const useVentesStore = defineStore('ventes', {
  state: () => ({
    /** @property {Array} ventes - Liste de toutes les ventes. */
    ventes: [],
    /** @property {boolean} loading - Indicateur de chargement. */
    loading: false,
    /** @property {string|null} error - Message d'erreur éventuel. */
    error: null
  }),

  getters: {
    /**
     * Retourne le nombre total de ventes.
     * @returns {number} Nombre de ventes dans la liste.
     */
    totalVentes: (state) => state.ventes.length
  },

  actions: {
    /**
     * Récupère toutes les ventes depuis l'API.
     * Met à jour la liste et gère les états de chargement et d'erreur.
     * @returns {Promise<void>}
     */
    async fetchVentes() {
      this.loading = true
      this.error = null
      try {
        const response = await api.get('/api/ventes')
        this.ventes = response.data
      } catch (error) {
        this.error = error.response?.data?.error || 'Erreur lors du chargement des ventes'
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Ajoute une nouvelle vente et rafraîchit la liste.
     * @param {Object} data - Données de la vente à créer.
     * @param {string} data.article - Nom de l'article.
     * @param {number} data.quantite - Quantité vendue.
     * @param {number} data.prix - Prix unitaire.
     * @param {string} data.type_paiement - Type de paiement (CB, Espece, Cheque).
     * @param {number} data.artisan_id - ID de l'artisan.
     * @param {string} data.date_vente - Date de la vente.
     * @returns {Promise<void>}
     */
    async addVente(data) {
      this.loading = true
      this.error = null
      try {
        await api.post('/api/ventes', data)
        await this.fetchVentes()
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
    }
  }
})