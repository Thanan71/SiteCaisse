/**
 * @module ventesController
 * @description Contrôleur de gestion des ventes.
 * Fournit les opérations CRUD (Create, Read, Update, Delete) pour les ventes.
 * Toutes les routes sont protégées par le middleware d'authentification JWT.
 */
const express = require('express');
const { getAllVentes, createVente, updateVente, deleteVente } = require('./models.cjs');
const { authMiddleware } = require('./authController.cjs');

const router = express.Router();

// Toutes les routes nécessitent une authentification
router.use(authMiddleware);

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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { date_debut, date_fin, type_paiement } = req.query;

    const result = await getAllVentes({
      page,
      limit,
      date_debut: date_debut || undefined,
      date_fin: date_fin || undefined,
      type_paiement: type_paiement || undefined
    });
    res.json(result);
  } catch (err) {
    console.error('GET ventes error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

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
    const { articles, type_paiement, artisan_id, date_vente } = req.body;

    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return res.status(400).json({
        error: 'Au moins un article est requis'
      });
    }

    if (!type_paiement || !artisan_id || !date_vente) {
      return res.status(400).json({
        error: 'Champs requis : articles, type_paiement, artisan_id, date_vente'
      });
    }

    const validPayments = ['CB', 'Espece', 'Cheque'];
    if (!validPayments.includes(type_paiement)) {
      return res.status(400).json({ error: 'Type de paiement invalide (CB, Espece, Cheque)' });
    }

    // Valider chaque article
    for (const [index, article] of articles.entries()) {
      if (!article.article || !article.prix) {
        return res.status(400).json({
          error: `Article ${index + 1} : le nom et le prix sont requis`
        });
      }
      if (article.prix <= 0) {
        return res.status(400).json({
          error: `Article ${index + 1} : le prix doit être supérieur à 0`
        });
      }
    }

    const vendeur_id = req.user.id;

    const id = await createVente(articles, type_paiement, artisan_id, vendeur_id, date_vente);

    res.status(201).json({ id, message: 'Vente créée avec succès' });
  } catch (err) {
    console.error('POST vente error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

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
    const id = parseInt(req.params.id, 10);

    // Si des articles sont fournis, valider
    if (req.body.articles) {
      if (!Array.isArray(req.body.articles) || req.body.articles.length === 0) {
        return res.status(400).json({ error: 'La liste des articles est invalide' });
      }
      for (const [index, article] of req.body.articles.entries()) {
        if (!article.article || !article.prix) {
          return res.status(400).json({
            error: `Article ${index + 1} : le nom et le prix sont requis`
          });
        }
      }
    }

    const updated = await updateVente(id, req.body);

    if (!updated) {
      return res.status(404).json({ error: 'Vente non trouvée ou aucune modification' });
    }

    res.json({ message: 'Vente modifiée avec succès' });
  } catch (err) {
    console.error('PUT vente error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * Supprime une vente existante.
 * @route DELETE /api/ventes/:id
 * @param {number} req.params.id - ID de la vente à supprimer.
 * @returns {Object} Message de confirmation de la suppression.
 * @throws {404} Si la vente n'est pas trouvée.
 */
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const deleted = await deleteVente(id);

    if (!deleted) {
      return res.status(404).json({ error: 'Vente non trouvée' });
    }

    res.json({ message: 'Vente supprimée avec succès' });
  } catch (err) {
    console.error('DELETE vente error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
