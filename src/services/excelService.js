/**
 * @module services/excelService
 * @description Service utilitaire d'export Excel.
 * Responsabilité unique : générer et télécharger des fichiers Excel.
 */
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

/**
 * Exporte un tableau de ventes au format Excel (pour un artisan spécifique).
 * @param {Array} ventes - Liste des ventes à exporter.
 * @param {Array} artisans - Liste des artisans (pour trouver le nom).
 * @param {number} artisanId - ID de l'artisan sélectionné.
 * @param {Object} summary - Résumé des ventes { total_articles, total_montant }.
 * @returns {void}
 */
export function exportVentesToExcel(ventes, artisans, artisanId, summary) {
  if (!ventes || ventes.length === 0) return

  const artisanName = artisans.find(a => a.id === artisanId)?.nom || 'Artisan'

  const worksheet = buildWorksheet(ventes, summary)

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Rapport')

  // Générer le fichier
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([excelBuffer], { type: 'application/octet-stream' })
  const fileName = `Rapport_${artisanName}_${new Date().toISOString().split('T')[0]}.xlsx`

  saveAs(blob, fileName)
}

/**
 * Exporte les rapports de tous les artisans dans un classeur Excel multi-onglets.
 * Chaque artisan a son propre onglet, et un onglet "Résumé global" est ajouté.
 * @param {Array} groupes - Liste des groupes (artisan_id, artisan_nom, ventes[], summary).
 * @param {Object} total - Résumé global { total_articles, total_montant }.
 * @returns {void}
 */
export function exportAllRapportsToExcel(groupes, total) {
  if (!groupes || groupes.length === 0) return

  const workbook = XLSX.utils.book_new()

  // Un onglet par artisan
  for (const groupe of groupes) {
    const sheetName = groupe.artisan_nom
      ? `Rapport - ${groupe.artisan_nom}`.substring(0, 31) // limitation Excel 31 caractères
      : `Artisan #${groupe.artisan_id}`
    const worksheet = buildWorksheet(groupe.ventes, groupe.summary)
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  }

  // Onglet récapitulatif global
  const globalRows = groupes.map(g => ({
    'Artisan': g.artisan_nom || `Artisan #${g.artisan_id}`,
    'Total articles': g.summary.total_articles,
    'Total montant (€)': g.summary.total_montant.toFixed(2)
  }))
  globalRows.push({
    'Artisan': 'TOTAL GLOBAL',
    'Total articles': total.total_articles,
    'Total montant (€)': total.total_montant.toFixed(2)
  })
  const globalSheet = XLSX.utils.json_to_sheet(globalRows)
  const globalColWidths = [
    { wch: 25 }, // Artisan
    { wch: 15 }, // Total articles
    { wch: 18 }  // Total montant
  ]
  globalSheet['!cols'] = globalColWidths
  XLSX.utils.book_append_sheet(workbook, globalSheet, 'Résumé global')

  // Générer le fichier
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([excelBuffer], { type: 'application/octet-stream' })
  const fileName = `Rapports_tous_artisans_${new Date().toISOString().split('T')[0]}.xlsx`

  saveAs(blob, fileName)
}

/**
 * Construit une worksheet (feuille) à partir d'un tableau de ventes et d'un résumé.
 * @param {Array} ventes - Liste des ventes.
 * @param {Object} summary - Résumé { total_articles, total_montant }.
 * @returns {Object} Worksheet XLSX.
 */
function buildWorksheet(ventes, summary) {
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

  return worksheet
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