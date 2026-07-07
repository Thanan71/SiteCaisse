/**
 * @module rapportService
 * @description Orchestration des rapports et de leurs commissions.
 */
'use strict'

const {
  getAllArtisans,
  getAllVentesGroupedByArtisan,
  getAllVentesGroupedByMonth,
  getVentesByArtisan,
  getVentesByMonth,
} = require('../models.cjs')
const {
  ajouterCommissionsAuxGroupes,
  ajouterCommissionAUnArtisan,
} = require('./commissionService.cjs')
const { getAllParametres } = require('./parametresService.cjs')

function parseCommissionRate(value) {
  return parseFloat(value) || 0
}

async function getCommissionRates() {
  const parametres = await getAllParametres()
  return {
    tauxPermanent: parseCommissionRate(parametres.commission_cb_permanent),
    tauxTemporaire: parseCommissionRate(parametres.commission_cb_temporaire),
    parametres: {
      commission_cb_permanent: parseCommissionRate(parametres.commission_cb_permanent),
      commission_cb_temporaire: parseCommissionRate(parametres.commission_cb_temporaire),
    },
  }
}

function withGroupCommissions(data, rates) {
  const { groupesAvecCommissions, totalGlobalCB, totalGlobalCommission } =
    ajouterCommissionsAuxGroupes(data.groupes, rates.tauxPermanent, rates.tauxTemporaire)

  return {
    groupes: groupesAvecCommissions,
    total: {
      ...data.total,
      total_cb: totalGlobalCB,
      total_commission: totalGlobalCommission,
    },
    parametres: rates.parametres,
  }
}

async function getRapportGlobal() {
  const [data, rates] = await Promise.all([getAllVentesGroupedByArtisan(), getCommissionRates()])
  return withGroupCommissions(data, rates)
}

async function getRapportMensuel() {
  const [data, rates] = await Promise.all([getAllVentesGroupedByMonth(), getCommissionRates()])

  const mois = data.mois.map((month) => {
    const { groupesAvecCommissions, totalGlobalCB, totalGlobalCommission } =
      ajouterCommissionsAuxGroupes(month.groupes, rates.tauxPermanent, rates.tauxTemporaire)

    return {
      ...month,
      groupes: groupesAvecCommissions,
      total: {
        ...month.total,
        total_cb: totalGlobalCB,
        total_commission: totalGlobalCommission,
      },
    }
  })

  return {
    mois,
    total: data.total,
    parametres: rates.parametres,
  }
}

async function getRapportParMois(mois) {
  const [data, rates] = await Promise.all([getVentesByMonth(mois), getCommissionRates()])
  return withGroupCommissions(data, rates)
}

async function getRapportArtisan(artisanId) {
  const [data, rates, artisans] = await Promise.all([
    getVentesByArtisan(artisanId),
    getCommissionRates(),
    getAllArtisans(),
  ])

  const artisan = artisans.find((item) => Number(item.id) === Number(artisanId))

  return ajouterCommissionAUnArtisan(
    data,
    artisan?.role || 'permanent',
    rates.tauxPermanent,
    rates.tauxTemporaire,
    artisan?.commission_cb_personnalisee ?? null,
  )
}

module.exports = {
  getRapportArtisan,
  getRapportGlobal,
  getRapportMensuel,
  getRapportParMois,
}
