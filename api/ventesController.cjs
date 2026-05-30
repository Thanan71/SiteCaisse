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
 * Récupère la liste complète de toutes les ventes enregistrées.
 * @route GET /api/ventes
 * @returns {Array<Object>} Tableau de toutes les ventes avec les noms des artisans et vendeurs.
 */
router.get('/', async (req, res) => {
  try {
    const ventes = await getAllVentes();
    res.json(ventes);
  } catch (err) {
    console.error('GET ventes error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * Crée une nouvelle vente.
 * @route POST /api/ventes
 * @param {string} req.body.article - Nom de l'article vendu (requis).
 * @param {number} [req.body.quantite=1] - Quantité vendue.
 * @param {number} req.body.prix - Prix unitaire de l'article (requis).
 * @param {string} req.body.type_paiement - Type de paiement, doit être 'CB', 'Espece' ou 'Cheque' (requis).
 * @param {number} req.body.artisan_id - ID de l'artisan concerné (requis).
 * @param {string} req.body.date_vente - Date de la vente au format ISO (requis).
 * @returns {Object} ID de la vente créée et message de confirmation.
 * @throws {400} Si un champ requis est manquant ou si le type de paiement est invalide.
 */
router.post('/', async (req, res) => {
  try {
    const { article, quantite, prix, type_paiement, artisan_id, date_vente } = req.body;

    if (!article || !prix || !type_paiement || !artisan_id || !date_vente) {
      return res.status(400).json({
        error: 'Champs requis : article, prix, type_paiement, artisan_id, date_vente'
      });
    }

    const validPayments = ['CB', 'Espece', 'Cheque'];
    if (!validPayments.includes(type_paiement)) {
      return res.status(400).json({ error: 'Type de paiement invalide (CB, Espece, Cheque)' });
    }

    const vendeur_id = req.user.id;
    const qte = quantite || 1;

    const id = await createVente(article, qte, prix, type_paiement, artisan_id, vendeur_id, date_vente);

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
 * @param {Object} req.body - Champs à modifier (article, quantite, prix, type_paiement, artisan_id, date_vente).
 * @returns {Object} Message de confirmation de la modification.
 * @throws {404} Si la vente n'est pas trouvée ou si aucun champ valide fourni.
 */
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
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