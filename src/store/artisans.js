/**
 * Store Artisans (Pinia)
 * Responsabilité unique : gérer le chargement et l'état des artisans
 */
import { defineStore } from 'pinia'
import axios from 'axios'

export const useArtisansStore = defineStore('artisans', {
  state: () => ({
    artisans: [],
    loading: false,
    error: null
  }),

  getters: {
    /**
     * Retourne la liste des artisans permanents
     */
    permanents: (state) => state.artisans.filter(a => a.role === 'permanent'),

    /**
     * Retourne la liste des artisans temporaires
     */
    temporaires: (state) => state.artisans.filter(a => a.role === 'temporaire'),

    /**
     * Retourne le nom d'un artisan par son ID
     */
    getArtisanName: (state) => (id) => {
      const artisan = state.artisans.find(a => a.id === id)
      return artisan ? artisan.nom : 'Artisan inconnu'
    }
  },

  actions: {
    /**
     * Récupère la liste des artisans depuis l'API
     */
    async fetchArtisans() {
      this.loading = true
      this.error = null
      try {
        const response = await axios.get('/api/rapports/artisans')
        this.artisans = response.data
      } catch (error) {
        this.error = error.response?.data?.error || 'Erreur lors du chargement des artisans'
        throw error
      } finally {
        this.loading = false
      }
    }
  }
})