import { defineStore } from 'pinia'
import axios from 'axios'
import { exportVentesToExcel } from '../services/excelService'

export const useRapportsStore = defineStore('rapports', {
  state: () => ({
    selectedArtisanId: null,
    ventesArtisan: [],
    summary: { total_articles: 0, total_montant: 0 },
    loading: false,
    error: null
  }),

  actions: {
    async fetchVentesByArtisan(id) {
      this.loading = true
      this.error = null
      this.selectedArtisanId = id
      try {
        const response = await axios.get(`/api/rapports/${id}`)
        this.ventesArtisan = response.data.ventes
        this.summary = response.data.summary
      } catch (error) {
        this.error = error.response?.data?.error || 'Erreur lors du chargement du rapport'
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Exporte les ventes de l'artisan sélectionné au format Excel
     * Délègue la logique d'export au service utilitaire excelService
     * @param {Array} artisans - Liste des artisans (passée depuis le composant)
     */
    exportToExcel(artisans) {
      exportVentesToExcel(
        this.ventesArtisan,
        artisans || [],
        this.selectedArtisanId,
        this.summary
      )
    }
  }
})
