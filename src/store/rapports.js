/**
 * @module store/rapports
 * @description Store Pinia de gestion des rapports.
 * Charge les ventes d'un artisan spécifique et délègue l'export Excel
 * au service utilitaire excelService.
 */
import { defineStore } from 'pinia'
import api from '../services/api'
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
    error: null,
    /** @property {Array} allRapports - Tous les rapports groupés par artisan (quand aucun filtre). */
    allRapports: [],
    /** @property {Object} totalGlobal - Résumé global de tous les artisans. */
    totalGlobal: { total_articles: 0, total_montant: 0 },
    /** @property {boolean} loadingAll - Indicateur de chargement pour tous les rapports. */
    loadingAll: false,
    /** @property {Object|null} totalAllParams - Paramètres des commissions. */
    totalAllParams: null,
    /** @property {Array} rapportsMensuel - Rapports groupés par mois. */
    rapportsMensuel: [],
    /** @property {boolean} loadingMensuel - Indicateur de chargement pour les rapports mensuels. */
    loadingMensuel: false,
  }),

  actions: {
    /**
     * Récupère les ventes de tous les artisans groupées par artisan.
     * @returns {Promise<void>}
     */
    async fetchAllRapports() {
      this.loadingAll = true
      this.error = null
      try {
        const response = await api.get('/api/rapports')
        this.allRapports = response.data.groupes
        this.totalGlobal = response.data.total
        this.totalAllParams = response.data.parametres || null
      } catch (error) {
        this.error = error.response?.data?.error || 'Erreur lors du chargement des rapports'
        throw error
      } finally {
        this.loadingAll = false
      }
    },

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
        const response = await api.get(`/api/rapports/${id}`)
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
     * Récupère les ventes groupées par mois.
     * @returns {Promise<void>}
     */
    async fetchRapportsMensuel() {
      this.loadingMensuel = true
      this.error = null
      try {
        const response = await api.get('/api/rapports/mensuel')
        this.rapportsMensuel = response.data.mois
        this.totalGlobal = response.data.total
        this.totalAllParams = response.data.parametres || null
      } catch (error) {
        this.error = error.response?.data?.error || 'Erreur lors du chargement des rapports mensuels'
        throw error
      } finally {
        this.loadingMensuel = false
      }
    },

    /**
     * Exporte les ventes de l'artisan sélectionné au format Excel.
     * Délègue la logique d'export au service utilitaire excelService.
     * @param {Array} artisans - Liste des artisans (passée depuis le composant pour résoudre le nom).
     * @returns {void}
     */
    exportToExcel(artisans) {
      exportVentesToExcel(this.ventesArtisan, artisans || [], this.selectedArtisanId, this.summary)
    },
  },
})
