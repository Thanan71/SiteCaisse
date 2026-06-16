/**
 * @module commissionService
 * @description Service de calcul des commissions CB.
 * Responsabilité unique : calculer les commissions sur les paiements par carte bancaire.
 */
'use strict'

/**
 * Calcule les commissions CB pour un ensemble de ventes.
 * @param {Array} ventes - Les ventes à analyser (doivent contenir `type_paiement` et `articles[]` avec `prix` et `quantite`).
 * @param {number} tauxCommission - Le taux de commission en pourcentage (ex: 1.5 pour 1.5%).
 * @returns {{total_cb: number, commission_cb: number}}
 * Un objet contenant le total des paiements CB et la commission calculée.
 */
function calculerCommissionsCB(ventes, tauxCommission) {
  const ventesCB = ventes.filter((v) => v.type_paiement === 'CB')

  let totalCB = 0
  for (const v of ventesCB) {
    const articles = v.articles || [{ prix: v.prix, quantite: v.quantite }]
    for (const art of articles) {
      totalCB += (art.prix || 0) * (art.quantite || 0)
    }
  }

  const commission = totalCB * (tauxCommission / 100)

  return { total_cb: totalCB, commission_cb: Math.round(commission * 100) / 100 }
}

/**
 * Ajoute les informations de commission CB aux résumés des groupes de ventes.
 * @param {Array} groupes - Groupes de ventes par artisan (chacun avec `ventes` et `summary`).
 * @param {number} tauxPermanent - Taux de commission pour les permanents.
 * @param {number} tauxTemporaire - Taux de commission pour les temporaires.
 * @returns {{groupesAvecCommissions: Array, totalGlobalCB: number, totalGlobalCommission: number}}
 */
function ajouterCommissionsAuxGroupes(groupes, tauxPermanent, tauxTemporaire) {
  let totalGlobalCB = 0
  let totalGlobalCommission = 0

  const groupesAvecCommissions = groupes.map((g) => {
    const role = g.artisan_role || g.ventes[0]?.artisan_role || 'permanent'
    const taux = role === 'temporaire' ? tauxTemporaire : tauxPermanent

    const cb = calculerCommissionsCB(g.ventes, taux)
    totalGlobalCB += cb.total_cb
    totalGlobalCommission += cb.commission_cb

    return {
      ...g,
      summary: {
        ...g.summary,
        total_cb: cb.total_cb,
        commission_cb: cb.commission_cb,
        taux_commission: taux,
      },
    }
  })

  return {
    groupesAvecCommissions,
    totalGlobalCB,
    totalGlobalCommission: Math.round(totalGlobalCommission * 100) / 100,
  }
}

/**
 * Ajoute les informations de commission CB au résumé d'un seul artisan.
 * @param {Object} data - Données de l'artisan contenant `ventes` et `summary`.
 * @param {Array} data.ventes - Ventes de l'artisan.
 * @param {Object} data.summary - Résumé actuel.
 * @param {string} role - Rôle de l'artisan ('permanent' ou 'temporaire').
 * @param {number} tauxPermanent - Taux de commission pour les permanents.
 * @param {number} tauxTemporaire - Taux de commission pour les temporaires.
 * @returns {Object} Données enrichies avec les informations de commission.
 */
function ajouterCommissionAUnArtisan(data, role, tauxPermanent, tauxTemporaire) {
  const taux = role === 'temporaire' ? tauxTemporaire : tauxPermanent
  const cb = calculerCommissionsCB(data.ventes, taux || 0)

  return {
    ...data,
    summary: {
      ...data.summary,
      total_cb: cb.total_cb,
      commission_cb: cb.commission_cb,
      taux_commission: taux || 0,
    },
  }
}

module.exports = {
  calculerCommissionsCB,
  ajouterCommissionsAuxGroupes,
  ajouterCommissionAUnArtisan,
}
