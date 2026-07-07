/**
 * @module rapportsController
 * @description Contrôleur de gestion des rapports.
 * Fournit les routes pour récupérer la liste des artisans
 * et les ventes détaillées d'un artisan spécifique.
 * Toutes les routes sont protégées par le middleware d'authentification JWT.
 */
const express = require('express')
const { getAllArtisans } = require('./models.cjs')
const { authMiddleware } = require('./authController.cjs')
const {
  getRapportArtisan,
  getRapportGlobal,
  getRapportMensuel,
  getRapportParMois,
} = require('./services/rapportService.cjs')
const { logError } = require('./services/loggerService.cjs')

const router = express.Router()

router.use(authMiddleware)

/**
 * Récupère les ventes de tous les artisans groupées par artisan.
 * @route GET /api/rapports
 * @returns {Object} Groupes de ventes par artisan avec résumé global et commissions CB.
 */
router.get('/', async (req, res) => {
  try {
    res.json(await getRapportGlobal())
  } catch (err) {
    console.error('GET all rapports error:', err)
    await logError({
      user: req.user,
      err,
      context: 'rapports.list',
      cible_type: 'rapport',
      req,
    })
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

/**
 * Récupère les ventes groupées par mois puis par artisan.
 * @route GET /api/rapports/mensuel
 * @returns {Object} Ventes groupées par mois avec résumé global.
 */
router.get('/mensuel', async (req, res) => {
  try {
    res.json(await getRapportMensuel())
  } catch (err) {
    console.error('GET rapports mensuel error:', err)
    await logError({
      user: req.user,
      err,
      context: 'rapports.mensuel',
      cible_type: 'rapport',
      req,
    })
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

/**
 * Récupère la liste de tous les artisans actifs pour le menu déroulant.
 * @route GET /api/rapports/artisans
 * @returns {Array<Object>} Liste des artisans (id, nom, nom_boutique, role).
 */
router.get('/artisans', async (req, res) => {
  try {
    const artisans = await getAllArtisans()
    res.json(artisans)
  } catch (err) {
    console.error('GET artisans error:', err)
    await logError({
      user: req.user,
      err,
      context: 'rapports.artisans',
      cible_type: 'rapport',
      req,
    })
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

/**
 * Récupère les ventes pour un mois spécifique (format YYYY-MM), groupées par artisan.
 * @route GET /api/rapports/mensuel/:mois
 * @param {string} req.params.mois - Le mois au format "YYYY-MM".
 * @returns {Object} Ventes groupées par artisan pour le mois avec résumé et commissions CB.
 */
router.get('/mensuel/:mois', async (req, res) => {
  try {
    const { mois } = req.params

    if (!/^\d{4}-\d{2}$/.test(mois)) {
      return res.status(400).json({ error: 'Format de mois invalide. Utilisez YYYY-MM' })
    }

    res.json(await getRapportParMois(mois))
  } catch (err) {
    console.error('GET rapport mensuel par mois error:', err)
    await logError({
      user: req.user,
      err,
      context: 'rapports.mensuel.mois',
      cible_type: 'rapport',
      req,
    })
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

/**
 * Récupère les ventes d'un artisan spécifique avec un résumé et les commissions CB.
 * @route GET /api/rapports/:artisan_id
 * @param {number} req.params.artisan_id - L'identifiant numérique de l'artisan.
 * @returns {Object} Données de ventes de l'artisan avec résumé et commission CB.
 * @throws {400} Si l'ID de l'artisan est invalide.
 */
router.get('/:artisan_id', async (req, res) => {
  try {
    const artisan_id = parseInt(req.params.artisan_id, 10)

    if (Number.isNaN(artisan_id)) {
      return res.status(400).json({ error: 'ID artisan invalide' })
    }

    res.json(await getRapportArtisan(artisan_id))
  } catch (err) {
    console.error('GET rapport artisan error:', err)
    await logError({
      user: req.user,
      err,
      context: 'rapports.artisan',
      cible_type: 'rapport',
      cible_id: req.params.artisan_id,
      req,
    })
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

module.exports = router
