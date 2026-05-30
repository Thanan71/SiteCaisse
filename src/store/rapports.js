import { defineStore } from 'pinia'
import axios from 'axios'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

export const useRapportsStore = defineStore('rapports', {
  state: () => ({
    artisans: [],
    selectedArtisanId: null,
    ventesArtisan: [],
    summary: { total_articles: 0, total_montant: 0 },
    loading: false,
    error: null
  }),

  actions: {
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
    },

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

    exportToExcel() {
      if (this.ventesArtisan.length === 0) return

      const artisanName = this.artisans.find(a => a.id === this.selectedArtisanId)?.nom || 'Artisan'

      // Préparer les données pour Excel
      const data = this.ventesArtisan.map(v => ({
        'Date': v.date_vente,
        'Article': v.article,
        'Quantité': v.quantite,
        'Prix unitaire (€)': v.prix,
        'Total (€)': (v.prix * v.quantite).toFixed(2),
        'Type de paiement': v.type_paiement === 'CB' ? 'Carte Bancaire' : v.type_paiement === 'Espece' ? 'Espèce' : 'Chèque',
        'Vendu par': v.vendeur_nom
      }))

      // Ajouter la ligne de résumé
      data.push({
        'Date': '',
        'Article': 'TOTAL',
        'Quantité': this.summary.total_articles,
        'Prix unitaire (€)': '',
        'Total (€)': this.summary.total_montant.toFixed(2),
        'Type de paiement': '',
        'Vendu par': ''
      })

      const worksheet = XLSX.utils.json_to_sheet(data)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Rapport')

      // Ajuster la largeur des colonnes
      const colWidths = [
        { wch: 12 }, // Date
        { wch: 30 }, // Article
        { wch: 10 }, // Quantité
        { wch: 15 }, // Prix unitaire
        { wch: 12 }, // Total
        { wch: 18 }, // Paiement
        { wch: 15 }  // Vendeur
      ]
      worksheet['!cols'] = colWidths

      // Générer le fichier
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([excelBuffer], { type: 'application/octet-stream' })
      const fileName = `Rapport_${artisanName}_${new Date().toISOString().split('T')[0]}.xlsx`

      saveAs(blob, fileName)
    }
  }
})