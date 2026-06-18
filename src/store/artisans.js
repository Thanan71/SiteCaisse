/**
 * @module store/artisans
 * @description Store Pinia dédié aux artisans.
 * Gère le chargement et l'état des artisans avec des getters
 * pour filtrer par rôle (permanent/temporaire).
 */
import { defineStore } from 'pinia'
import api from '../services/api'

export const useArtisansStore = defineStore('artisans', {
  state: () => ({
    /** @property {Array} artisans - Liste des artisans chargés depuis l'API. */
    artisans: [],
    /** @property {boolean} loading - Indicateur de chargement. */
    loading: false,
    /** @property {string|null} error - Message d'erreur éventuel. */
    error: null,
  }),

  getters: {
    /**
     * Filtre et retourne uniquement les artisans avec le rôle 'permanent'.
     * @returns {Array} Tableau des artisans permanents.
     */
    permanents: (state) => state.artisans.filter((a) => a.role === 'permanent'),

    /**
     * Filtre et retourne uniquement les artisans avec le rôle 'temporaire'.
     * @returns {Array} Tableau des artisans temporaires.
     */
    temporaires: (state) => state.artisans.filter((a) => a.role === 'temporaire'),

    /**
     * Retourne le nom d'un artisan à partir de son ID.
     * @returns {Function} Fonction prenant un id en paramètre et retournant le nom.
     * @param {number} id - ID de l'artisan recherché.
     * @returns {string} Nom de l'artisan ou 'Artisan inconnu'.
     */
    getArtisanName: (state) => (id) => {
      const artisan = state.artisans.find((a) => a.id === id)
      return artisan ? (artisan.nom_boutique || artisan.nom) : 'Artisan inconnu'
    },
  },

  actions: {
    /**
     * Récupère la liste des artisans depuis l'API.
     * Met à jour la liste et gère les états de chargement et d'erreur.
     * @returns {Promise<void>}
     */
    async fetchArtisans() {
      this.loading = true
      this.error = null
      try {
        const response = await api.get('/api/rapports/artisans')
        this.artisans = response.data
      } catch (error) {
        this.error = error.response?.data?.error || 'Erreur lors du chargement des artisans'
        throw error
      } finally {
        this.loading = false
      }
    },
  },
})
