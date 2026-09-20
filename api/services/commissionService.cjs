/**
 * @module commissionService
 * @description Service de calcul des commissions selon le rôle de l'artisan.
 * Invités (temporaires) : tous les paiements. Permanents : carte bancaire uniquement.
 */
'use strict'

/**
 * Calcule la commission et conserve séparément le total des paiements CB.
 * @param {Array} ventes - Les ventes à analyser (doivent contenir `type_paiement` et `articles[]` avec `prix` et `quantite`).
 * @param {number} tauxCommission - Le taux de commission en pourcentage (ex: 1.5 pour 1.5%).
 * @param {string} role - Rôle de l'artisan ('permanent' ou 'temporaire').
 * @returns {{total_cb: number, commission_cb: number, assiette_commission: string}}
 * Le champ historique `commission_cb` contient la commission de l'assiette applicable.
 */
function calculerCommissions(ventes, tauxCommission, role = 'permanent') {
  const tousPaiements = role === 'temporaire'
  let totalCB = 0
  let baseCommission = 0

  for (const v of ventes) {
    const paiementCB = v.type_paiement === 'CB'
    const articles = v.articles || [{ prix: v.prix, quantite: v.quantite }]
    for (const art of articles) {
      const montant = (art.prix || 0) * (art.quantite || 0)
      if (paiementCB) totalCB += montant
      if (tousPaiements || paiementCB) baseCommission += montant
    }
  }

  const commission = baseCommission * (tauxCommission / 100)

  return {
    total_cb: totalCB,
    commission_cb: Math.round(commission * 100) / 100,
    assiette_commission: tousPaiements ? 'tous_paiements' : 'cb',
  }
}

function parseTauxPersonnalise(value) {
  if (value === null || value === undefined || value === '') return null

  const parsed = parseFloat(value)
  return Number.isNaN(parsed) ? null : parsed
}

function getTauxCommission(role, tauxPermanent, tauxTemporaire, tauxPersonnalise) {
  const tauxPerso = parseTauxPersonnalise(tauxPersonnalise)
  if (tauxPerso !== null) {
    return { taux: tauxPerso, personnalise: true }
  }

  return {
    taux: role === 'temporaire' ? tauxTemporaire : tauxPermanent,
    personnalise: false,
  }
}

/**
 * Ajoute les informations de commission aux résumés des groupes de ventes.
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
    const { taux, personnalise } = getTauxCommission(
      role,
      tauxPermanent,
      tauxTemporaire,
      g.commission_cb_personnalisee,
    )

    const commission = calculerCommissions(g.ventes, taux, role)
    totalGlobalCB += commission.total_cb
    totalGlobalCommission += commission.commission_cb

    return {
      ...g,
      summary: {
        ...g.summary,
        ...commission,
        taux_commission: taux,
        commission_personnalisee: personnalise,
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
 * Ajoute les informations de commission au résumé d'un seul artisan.
 * @param {Object} data - Données de l'artisan contenant `ventes` et `summary`.
 * @param {Array} data.ventes - Ventes de l'artisan.
 * @param {Object} data.summary - Résumé actuel.
 * @param {string} role - Rôle de l'artisan ('permanent' ou 'temporaire').
 * @param {number} tauxPermanent - Taux de commission pour les permanents.
 * @param {number} tauxTemporaire - Taux de commission pour les temporaires.
 * @param {number|null} tauxPersonnalise - Taux personnalisé optionnel.
 * @returns {Object} Données enrichies avec les informations de commission.
 */
function ajouterCommissionAUnArtisan(
  data,
  role,
  tauxPermanent,
  tauxTemporaire,
  tauxPersonnalise = null,
) {
  const { taux, personnalise } = getTauxCommission(
    role,
    tauxPermanent,
    tauxTemporaire,
    tauxPersonnalise,
  )
  const commission = calculerCommissions(data.ventes, taux || 0, role)

  return {
    ...data,
    summary: {
      ...data.summary,
      ...commission,
      taux_commission: taux || 0,
      commission_personnalisee: personnalise,
    },
  }
}

module.exports = {
  calculerCommissions,
  ajouterCommissionsAuxGroupes,
  ajouterCommissionAUnArtisan,
  getTauxCommission,
}
