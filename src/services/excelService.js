/**
 * @module services/excelService
 * @description Service utilitaire d'export Excel.
 * Responsabilité unique : générer et télécharger des fichiers Excel.
 */
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

/**
 * Exporte un tableau de ventes au format Excel.
 * @param {Array} ventes - Liste des ventes à exporter.
 * @param {Array} artisans - Liste des artisans (pour trouver le nom).
 * @param {number} artisanId - ID de l'artisan sélectionné.
 * @param {Object} summary - Résumé des ventes { total_articles, total_montant }.
 * @returns {void}
 */
export function exportVentesToExcel(ventes, artisans, artisanId, summary) {
  if (!ventes || ventes.length === 0) return

  const artisanName = artisans.find(a => a.id === artisanId)?.nom || 'Artisan'

  // Préparer les données pour Excel
  const data = ventes.map(v => ({
    'Date': v.date_vente,
    'Article': v.article,
    'Quantité': v.quantite,
    'Prix unitaire (€)': v.prix,
    'Total (€)': (v.prix * v.quantite).toFixed(2),
    'Type de paiement': formatPaymentForExcel(v.type_paiement),
    'Vendu par': v.vendeur_nom
  }))

  // Ajouter la ligne de résumé
  data.push({
    'Date': '',
    'Article': 'TOTAL',
    'Quantité': summary.total_articles,
    'Prix unitaire (€)': '',
    'Total (€)': summary.total_montant.toFixed(2),
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

/**
 * Formate le type de paiement pour l'affichage dans Excel.
 * Convertit le code interne en libellé français lisible.
 * @param {string} type - Code du type de paiement ('CB', 'Espece', 'Cheque').
 * @returns {string} Libellé formaté en français.
 */
function formatPaymentForExcel(type) {
  const labels = {
    'CB': 'Carte Bancaire',
    'Espece': 'Espèce',
    'Cheque': 'Chèque'
  }
  return labels[type] || type
}