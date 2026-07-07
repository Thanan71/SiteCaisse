/**
 * @module ventesController
 * @description Contrôleur de gestion des ventes.
 * Fournit les opérations CRUD (Create, Read, Update, Delete) pour les ventes.
 * Toutes les routes sont protégées par le middleware d'authentification JWT.
 */
const express = require('express')
const { getAllVentes, createVente, updateVente, deleteVente } = require('./models.cjs')
const { authMiddleware } = require('./authController.cjs')
const { logAction, logError } = require('./services/loggerService.cjs')
const {
  ValidationError,
  parseVentesListQuery,
  validateCreateVentePayload,
  validateUpdateVentePayload,
} = require('./services/venteValidationService.cjs')

const router = express.Router()

// Toutes les routes nécessitent une authentification
router.use(authMiddleware)

function sendValidationError(err, res) {
  if (!(err instanceof ValidationError)) return false
  res.status(err.statusCode).json({ error: err.message })
  return true
}

/**
 * Récupère la liste des ventes avec pagination et filtres optionnels.
 * @route GET /api/ventes
 * @query {number} [page=1] - Numéro de la page.
 * @query {number} [limit=10] - Nombre d'éléments par page.
 * @query {string} [date_debut] - Date de début du filtre (format ISO).
 * @query {string} [date_fin] - Date de fin du filtre (format ISO).
 * @query {string} [type_paiement] - Filtre par type de paiement (CB, Espece, Cheque).
 * @returns {Object} Liste des ventes avec informations de pagination.
 */
router.get('/', async (req, res) => {
  try {
    const result = await getAllVentes(parseVentesListQuery(req.query))
    res.json(result)
  } catch (err) {
    console.error('GET ventes error:', err)
    await logError({
      user: req.user,
      err,
      context: 'ventes.list',
      cible_type: 'vente',
      req,
    })
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

/**
 * Crée une nouvelle vente avec un ou plusieurs articles.
 * @route POST /api/ventes
 * @param {Array<{article: string, quantite: number, prix: number}>} req.body.articles - Liste des articles vendus (requis, minimum 1).
 * @param {string} req.body.type_paiement - Type de paiement, doit être 'CB', 'Espece' ou 'Cheque' (requis).
 * @param {number} req.body.artisan_id - ID de l'artisan concerné (requis).
 * @param {string} req.body.date_vente - Date de la vente au format ISO (requis).
 * @returns {Object} ID de la vente créée et message de confirmation.
 * @throws {400} Si un champ requis est manquant ou si le type de paiement est invalide.
 */
router.post('/', async (req, res) => {
  try {
    const { articles, type_paiement, date_vente } = validateCreateVentePayload(req.body)
    const vendeur_id = req.user.id

    const id = await createVente(articles, type_paiement, vendeur_id, date_vente)

    await logAction({
      user: req.user,
      action: 'vente.create',
      cible_type: 'vente',
      cible_id: id,
      details: { articles, type_paiement, date_vente },
      req,
    })

    res.status(201).json({ id, message: 'Vente créée avec succès' })
  } catch (err) {
    if (sendValidationError(err, res)) return

    console.error('POST vente error:', err)
    await logError({
      user: req.user,
      err,
      context: 'ventes.create',
      cible_type: 'vente',
      details: {
        type_paiement: req.body?.type_paiement || null,
        date_vente: req.body?.date_vente || null,
      },
      req,
    })
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

/**
 * Modifie une vente existante.
 * @route PUT /api/ventes/:id
 * @param {number} req.params.id - ID de la vente à modifier.
 * @param {Object} req.body - Champs à modifier (type_paiement, artisan_id, date_vente, articles).
 * @param {Array} [req.body.articles] - Nouvelle liste d'articles (remplace les anciens).
 * @returns {Object} Message de confirmation de la modification.
 * @throws {404} Si la vente n'est pas trouvée ou si aucun champ valide fourni.
 */
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)

    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID vente invalide' })
    }

    validateUpdateVentePayload(req.body)

    const updated = await updateVente(id, req.body)

    if (!updated) {
      return res.status(404).json({ error: 'Vente non trouvée ou aucune modification' })
    }

    await logAction({
      user: req.user,
      action: 'vente.update',
      cible_type: 'vente',
      cible_id: id,
      details: { modifications: req.body },
      req,
    })

    res.json({ message: 'Vente modifiée avec succès' })
  } catch (err) {
    if (sendValidationError(err, res)) return

    console.error('PUT vente error:', err)
    await logError({
      user: req.user,
      err,
      context: 'ventes.update',
      cible_type: 'vente',
      cible_id: req.params.id,
      req,
    })
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

/**
 * Supprime une vente existante.
 * @route DELETE /api/ventes/:id
 * @param {number} req.params.id - ID de la vente à supprimer.
 * @returns {Object} Message de confirmation de la suppression.
 * @throws {404} Si la vente n'est pas trouvée.
 */
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)

    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID vente invalide' })
    }

    const deleted = await deleteVente(id)

    if (!deleted) {
      return res.status(404).json({ error: 'Vente non trouvée' })
    }

    await logAction({
      user: req.user,
      action: 'vente.delete',
      cible_type: 'vente',
      cible_id: id,
      req,
    })

    res.json({ message: 'Vente supprimée avec succès' })
  } catch (err) {
    console.error('DELETE vente error:', err)
    await logError({
      user: req.user,
      err,
      context: 'ventes.delete',
      cible_type: 'vente',
      cible_id: req.params.id,
      req,
    })
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

module.exports = router
