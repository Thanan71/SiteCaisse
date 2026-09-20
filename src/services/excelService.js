/**
 * @module services/excelService
 * @description Service utilitaire d'export Excel.
 * Responsabilité unique : générer et télécharger des fichiers Excel.
 */

import { saveAs } from 'file-saver'
import * as XLSX from 'xlsx'
import { formatMonthLabel } from '../utils/formatters'

/**
 * Exporte un tableau de ventes au format Excel (pour un artisan spécifique).
 * @param {Array} ventes - Liste des ventes à exporter (avec articles[] imbriqué).
 * @param {Array} artisans - Liste des artisans (pour trouver le nom).
 * @param {number} artisanId - ID de l'artisan sélectionné.
 * @param {Object} summary - Résumé des ventes, commission et assiette_commission ('cb' ou 'tous_paiements').
 * @returns {void}
 */
export function exportVentesToExcel(ventes, artisans, artisanId, summary) {
  if (!ventes || ventes.length === 0) return

  const artisan = artisans.find((a) => String(a.id) === String(artisanId))
  const artisanName = artisan?.nom_boutique || artisan?.nom || 'Artisan'

  const worksheet = buildWorksheet(ventes, summary, artisanName)

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Rapport')

  // Générer le fichier
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([excelBuffer], { type: 'application/octet-stream' })
  const fileName = `Rapport_${artisanName}_${new Date().toISOString().split('T')[0]}.xlsx`

  saveAs(blob, fileName)
}

/**
 * Exporte les rapports d'un mois spécifique dans un classeur Excel multi-onglets.
 * @param {Array} groupes - Liste des groupes (artisan_id, artisan_nom, ventes[], summary).
 * @param {Object} total - Résumé du mois { total_articles, total_montant, total_cb, total_commission }.
 * @param {Object} parametres - Paramètres des commissions.
 * @param {string} mois - Le mois au format "YYYY-MM".
 * @returns {void}
 */
export function exportMonthToExcel(groupes, total, parametres, mois) {
  if (!groupes || groupes.length === 0) return

  const workbook = XLSX.utils.book_new()

  // Un onglet par artisan
  for (const groupe of groupes) {
    const sheetName = groupe.artisan_nom
      ? `Rapport - ${groupe.artisan_nom}`.substring(0, 31)
      : groupe.artisan_id !== null && groupe.artisan_id !== undefined
        ? `Artisan #${groupe.artisan_id}`
        : 'Artisan inconnu'
    const worksheet = buildWorksheet(groupe.ventes, groupe.summary, groupe.artisan_nom || sheetName)
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  }

  // Onglet récapitulatif du mois
  const globalRows = groupes.map((g) => ({
    Artisan:
      g.artisan_nom ||
      (g.artisan_id !== null && g.artisan_id !== undefined
        ? `Artisan #${g.artisan_id}`
        : 'Artisan inconnu'),
    'Total articles': g.summary.total_articles,
    'Total montant (€)': g.summary.total_montant.toFixed(2),
    'Total CB (€)': (g.summary.total_cb || 0).toFixed(2),
    'Assiette commission': formatCommissionScope(g.summary),
    'Taux commission (%)': g.summary.taux_commission || 0,
    'Commission (€)': (g.summary.commission_cb || 0).toFixed(2),
  }))

  globalRows.push({
    Artisan: 'TOTAL DU MOIS',
    'Total articles': total.total_articles,
    'Total montant (€)': total.total_montant.toFixed(2),
    'Total CB (€)': (total.total_cb || 0).toFixed(2),
    'Assiette commission': '',
    'Taux commission (%)': '',
    'Commission (€)': (total.total_commission || 0).toFixed(2),
  })

  if (parametres) {
    globalRows.push({
      Artisan: 'Taux appliqués',
      'Total articles': '',
      'Total montant (€)': '',
      'Total CB (€)': '',
      'Assiette commission': '',
      'Taux commission (%)': '',
      'Commission (€)': '',
    })
    globalRows.push({
      Artisan: 'Permanent',
      'Total articles': '',
      'Total montant (€)': '',
      'Total CB (€)': '',
      'Assiette commission': 'CB',
      'Taux commission (%)': parametres.commission_cb_permanent || '',
      'Commission (€)': '',
    })
    globalRows.push({
      Artisan: 'Invité',
      'Total articles': '',
      'Total montant (€)': '',
      'Total CB (€)': '',
      'Assiette commission': 'Tous paiements',
      'Taux commission (%)': parametres.commission_cb_temporaire || '',
      'Commission (€)': '',
    })
  }

  const globalSheet = XLSX.utils.json_to_sheet(globalRows)
  const globalColWidths = [
    { wch: 25 },
    { wch: 15 },
    { wch: 18 },
    { wch: 15 },
    { wch: 22 },
    { wch: 18 },
    { wch: 18 },
  ]
  globalSheet['!cols'] = globalColWidths
  XLSX.utils.book_append_sheet(workbook, globalSheet, 'Résumé du mois')

  // Générer le fichier
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([excelBuffer], { type: 'application/octet-stream' })
  const fileName = `Rapport_mensuel_${formatMonthLabel(mois).replace(' ', '_')}.xlsx`

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
      : groupe.artisan_id !== null && groupe.artisan_id !== undefined
        ? `Artisan #${groupe.artisan_id}`
        : 'Artisan inconnu'
    const worksheet = buildWorksheet(groupe.ventes, groupe.summary, groupe.artisan_nom || sheetName)
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  }

  // Onglet récapitulatif global
  const globalRows = groupes.map((g) => ({
    Artisan:
      g.artisan_nom ||
      (g.artisan_id !== null && g.artisan_id !== undefined
        ? `Artisan #${g.artisan_id}`
        : 'Artisan inconnu'),
    'Total articles': g.summary.total_articles,
    'Total montant (€)': g.summary.total_montant.toFixed(2),
    'Total CB (€)': (g.summary.total_cb || 0).toFixed(2),
    'Assiette commission': formatCommissionScope(g.summary),
    'Taux commission (%)': g.summary.taux_commission || 0,
    'Commission (€)': (g.summary.commission_cb || 0).toFixed(2),
  }))

  // Ligne des totaux globaux
  globalRows.push({
    Artisan: 'TOTAL GLOBAL',
    'Total articles': total.total_articles,
    'Total montant (€)': total.total_montant.toFixed(2),
    'Total CB (€)': (total.total_cb || 0).toFixed(2),
    'Assiette commission': '',
    'Taux commission (%)': '',
    'Commission (€)': (total.total_commission || 0).toFixed(2),
  })

  // Ligne d'information sur les taux
  if (parametres) {
    globalRows.push({
      Artisan: 'Taux appliqués',
      'Total articles': '',
      'Total montant (€)': '',
      'Total CB (€)': '',
      'Assiette commission': '',
      'Taux commission (%)': '',
      'Commission (€)': '',
    })
    globalRows.push({
      Artisan: 'Permanent',
      'Total articles': '',
      'Total montant (€)': '',
      'Total CB (€)': '',
      'Assiette commission': 'CB',
      'Taux commission (%)': parametres.commission_cb_permanent || '',
      'Commission (€)': '',
    })
    globalRows.push({
      Artisan: 'Invité',
      'Total articles': '',
      'Total montant (€)': '',
      'Total CB (€)': '',
      'Assiette commission': 'Tous paiements',
      'Taux commission (%)': parametres.commission_cb_temporaire || '',
      'Commission (€)': '',
    })
  }

  const globalSheet = XLSX.utils.json_to_sheet(globalRows)
  const globalColWidths = [
    { wch: 25 }, // Artisan
    { wch: 15 }, // Total articles
    { wch: 18 }, // Total montant
    { wch: 15 }, // Total CB
    { wch: 22 }, // Assiette commission
    { wch: 18 }, // Taux commission
    { wch: 18 }, // Commission
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
 * @param {Object} summary - Résumé des ventes, commission et assiette_commission ('cb' ou 'tous_paiements').
 * @param {string} artisanName - Nom de l'artisan affiché dans la partie à facturer.
 * @returns {Object} Worksheet XLSX.
 */
function buildWorksheet(ventes, summary, artisanName) {
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

  // Ajouter la commission avec l'assiette applicable au rôle de l'artisan.
  if (summary.commission_cb && summary.commission_cb > 0) {
    const tousPaiements = summary.assiette_commission === 'tous_paiements'
    const commissionLabel = `Commission ${tousPaiements ? 'tous paiements' : 'CB'}${summary.commission_personnalisee ? ' personnalisée' : ''}`
    const baseCommission = tousPaiements ? summary.total_montant : summary.total_cb || 0

    data.push({
      Date: '',
      Article: `${commissionLabel} (${summary.taux_commission || 0}%)`,
      Quantité: '',
      'Prix unitaire (€)': '',
      'Total (€)': `-${summary.commission_cb.toFixed(2)}`,
      'Type de paiement': tousPaiements
        ? `sur ${baseCommission.toFixed(2)}€ tous paiements`
        : `sur ${baseCommission.toFixed(2)}€ de CB`,
      'Vendu par': '',
    })
  }

  const invite = summary.assiette_commission === 'tous_paiements'
  const invitePersonnalise = invite && summary.commission_personnalisee
  const ventesAFacturer = invitePersonnalise ? summary.total_montant : summary.total_cb || 0
  // Sans taux personnalisé, seuls les frais sur les ventes CB sont à facturer à l'invité.
  const frais =
    invite && !summary.commission_personnalisee
      ? Math.round((summary.total_cb || 0) * ((summary.taux_commission || 0) / 100) * 100) / 100
      : summary.commission_cb || 0
  const fraisLabel = invite ? 'Frais de fonctionnement' : 'Frais CB'

  data.push({}, { Article: 'À FACTURER' }, { Article: `Artisan : ${artisanName}` })
  const creditRow = data.length + 2 // La première ligne Excel contient les en-têtes.
  data.push(
    {
      Article: invitePersonnalise ? '+ Toutes les ventes' : '+ Ventes CB',
      'Total (€)': ventesAFacturer,
    },
    { Article: `- ${fraisLabel}`, 'Total (€)': frais ? -frais : 0 },
    {
      Article: 'TOTAL À FACTURER',
      'Total (€)': Math.round((ventesAFacturer - frais) * 100) / 100,
    },
  )

  const worksheet = XLSX.utils.json_to_sheet(data)
  for (let row = creditRow; row <= creditRow + 2; row++) {
    const cell = worksheet[`E${row}`]
    if (cell) cell.z = '#,##0.00" €"'
  }
  const totalAFacturerCell = worksheet[`E${creditRow + 2}`]
  if (totalAFacturerCell) {
    totalAFacturerCell.f = `ROUND(SUM(E${creditRow}:E${creditRow + 1}),2)`
  }

  // Ajuster la largeur des colonnes
  const colWidths = [
    { wch: 12 }, // Date
    { wch: 50 }, // Article et libellé de commission
    { wch: 10 }, // Quantité
    { wch: 15 }, // Prix unitaire
    { wch: 18 }, // Total et montants à facturer
    { wch: 35 }, // Paiement et assiette de commission
    { wch: 15 }, // Vendeur
  ]
  worksheet['!cols'] = colWidths

  return worksheet
}

function formatCommissionScope(summary) {
  return summary.assiette_commission === 'tous_paiements' ? 'Tous paiements' : 'CB'
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
