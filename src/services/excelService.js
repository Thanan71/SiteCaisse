/**
 * @module services/excelService
 * @description Service utilitaire d'export Excel.
 * Responsabilité unique : générer et télécharger des fichiers Excel.
 */

import { saveAs } from 'file-saver'
import * as XLSX from 'xlsx'

/**
 * Exporte un tableau de ventes au format Excel (pour un artisan spécifique).
 * @param {Array} ventes - Liste des ventes à exporter (avec articles[] imbriqué).
 * @param {Array} artisans - Liste des artisans (pour trouver le nom).
 * @param {number} artisanId - ID de l'artisan sélectionné.
 * @param {Object} summary - Résumé des ventes { total_articles, total_montant, total_cb, commission_cb, taux_commission }.
 * @returns {void}
 */
export function exportVentesToExcel(ventes, artisans, artisanId, summary) {
  if (!ventes || ventes.length === 0) return

  const artisanName = artisans.find((a) => a.id === artisanId)?.nom || 'Artisan'

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
 * @param {Array} groupes - Liste des groupes (artisan_id, artisan_nom, ventes[], summary avec commission_cb).
 * @param {Object} total - Résumé global { total_articles, total_montant, total_cb, total_commission }.
 * @param {Object} parametres - Paramètres des commissions { commission_cb_permanent, commission_cb_temporaire }.
 * @returns {void}
 */
export function exportAllRapportsToExcel(groupes, total, parametres) {
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
  const globalRows = groupes.map((g) => ({
    Artisan: g.artisan_nom || `Artisan #${g.artisan_id}`,
    'Total articles': g.summary.total_articles,
    'Total montant (€)': g.summary.total_montant.toFixed(2),
    'Total CB (€)': (g.summary.total_cb || 0).toFixed(2),
    'Taux commission (%)': g.summary.taux_commission || 0,
    'Commission CB (€)': (g.summary.commission_cb || 0).toFixed(2),
  }))

  // Ligne des totaux globaux
  globalRows.push({
    Artisan: 'TOTAL GLOBAL',
    'Total articles': total.total_articles,
    'Total montant (€)': total.total_montant.toFixed(2),
    'Total CB (€)': (total.total_cb || 0).toFixed(2),
    'Taux commission (%)': '',
    'Commission CB (€)': (total.total_commission || 0).toFixed(2),
  })

  // Ligne d'information sur les taux
  if (parametres) {
    globalRows.push({
      Artisan: 'Taux appliqués',
      'Total articles': '',
      'Total montant (€)': '',
      'Total CB (€)': '',
      'Taux commission (%)': '',
      'Commission CB (€)': '',
    })
    globalRows.push({
      Artisan: 'Permanent',
      'Total articles': '',
      'Total montant (€)': '',
      'Total CB (€)': '',
      'Taux commission (%)': parametres.commission_cb_permanent || '',
      'Commission CB (€)': '',
    })
    globalRows.push({
      Artisan: 'Temporaire',
      'Total articles': '',
      'Total montant (€)': '',
      'Total CB (€)': '',
      'Taux commission (%)': parametres.commission_cb_temporaire || '',
      'Commission CB (€)': '',
    })
  }

  const globalSheet = XLSX.utils.json_to_sheet(globalRows)
  const globalColWidths = [
    { wch: 25 }, // Artisan
    { wch: 15 }, // Total articles
    { wch: 18 }, // Total montant
    { wch: 15 }, // Total CB
    { wch: 18 }, // Taux commission
    { wch: 18 }, // Commission CB
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
 * @param {Array} ventes - Liste des ventes (avec articles[] imbriqué).
 * @param {Object} summary - Résumé { total_articles, total_montant, total_cb, commission_cb, taux_commission }.
 * @returns {Object} Worksheet XLSX.
 */
function buildWorksheet(ventes, summary) {
  // Aplatir les ventes avec leurs articles en lignes individuelles
  const data = []
  for (const v of ventes) {
    const articles = v.articles || [{ article: v.article, quantite: v.quantite, prix: v.prix }]
    for (const art of articles) {
      data.push({
        Date: v.date_vente,
        Article: art.article,
        Quantité: art.quantite,
        'Prix unitaire (€)': art.prix,
        'Total (€)': (art.prix * art.quantite).toFixed(2),
        'Type de paiement': formatPaymentForExcel(v.type_paiement),
        'Vendu par': v.vendeur_nom,
      })
    }
  }

  // Ajouter la ligne de résumé
  data.push({
    Date: '',
    Article: 'TOTAL',
    Quantité: summary.total_articles,
    'Prix unitaire (€)': '',
    'Total (€)': summary.total_montant.toFixed(2),
    'Type de paiement': '',
    'Vendu par': '',
  })

  // Ajouter la ligne de commission CB si elle existe
  if (summary.commission_cb && summary.commission_cb > 0) {
    data.push({
      Date: '',
      Article: `Commission CB (${summary.taux_commission || 0}%)`,
      Quantité: '',
      'Prix unitaire (€)': '',
      'Total (€)': `-${summary.commission_cb.toFixed(2)}`,
      'Type de paiement': `sur ${(summary.total_cb || 0).toFixed(2)}€ de CB`,
      'Vendu par': '',
    })
  }

  const worksheet = XLSX.utils.json_to_sheet(data)

  // Ajuster la largeur des colonnes
  const colWidths = [
    { wch: 12 }, // Date
    { wch: 30 }, // Article
    { wch: 10 }, // Quantité
    { wch: 15 }, // Prix unitaire
    { wch: 12 }, // Total
    { wch: 25 }, // Paiement
    { wch: 15 }, // Vendeur
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
    CB: 'Carte Bancaire',
    Espece: 'Espèce',
    Cheque: 'Chèque',
  }
  return labels[type] || type
}
