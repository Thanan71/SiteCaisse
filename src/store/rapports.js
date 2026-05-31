/**
 * @module store/rapports
 * @description Store Pinia de gestion des rapports.
 * Charge les ventes d'un artisan spécifique et délègue l'export Excel
 * au service utilitaire excelService.
 */
import { defineStore } from 'pinia'
import axios from 'axios'
import { exportVentesToExcel } from '../services/excelService'

export const useRapportsStore = defineStore('rapports', {
  state: () => ({
    /** @property {number|null} selectedArtisanId - ID de l'artisan sélectionné. */
    selectedArtisanId: null,
    /** @property {Array} ventesArtisan - Ventes de l'artisan sélectionné. */
    ventesArtisan: [],
    /** @property {Object} summary - Résumé des ventes (total_articles, total_montant). */
    summary: { total_articles: 0, total_montant: 0 },
    /** @property {boolean} loading - Indicateur de chargement. */
    loading: false,
    /** @property {string|null} error - Message d'erreur éventuel. */
    error: null
  }),

  actions: {
    /**
     * Récupère les ventes d'un artisan spécifique et met à jour le résumé.
     * @param {number} id - ID de l'artisan dont on veut les ventes.
     * @returns {Promise<void>}
     */
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
     * Exporte les ventes de l'artisan sélectionné au format Excel.
     * Délègue la logique d'export au service utilitaire excelService.
     * @param {Array} artisans - Liste des artisans (passée depuis le composant pour résoudre le nom).
     * @returns {void}
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