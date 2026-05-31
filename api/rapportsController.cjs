/**
 * @module rapportsController
 * @description Contrôleur de gestion des rapports.
 * Fournit les routes pour récupérer la liste des artisans
 * et les ventes détaillées d'un artisan spécifique.
 * Toutes les routes sont protégées par le middleware d'authentification JWT.
 */
const express = require('express');
const { getAllArtisans, getVentesByArtisan, getAllVentesGroupedByArtisan } = require('./models.cjs');
const { authMiddleware } = require('./authController.cjs');

const router = express.Router();

router.use(authMiddleware);

/**
 * Récupère les ventes de tous les artisans groupées par artisan.
 * @route GET /api/rapports
 * @returns {Object} Groupes de ventes par artisan avec résumé global.
 */
router.get('/', async (req, res) => {
  try {
    const data = await getAllVentesGroupedByArtisan();
    res.json(data);
  } catch (err) {
    console.error('GET all rapports error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * Récupère la liste de tous les artisans actifs pour le menu déroulant.
 * @route GET /api/rapports/artisans
 * @returns {Array<Object>} Liste des artisans (id, nom, email, role).
 */
router.get('/artisans', async (req, res) => {
  try {
    const artisans = await getAllArtisans();
    res.json(artisans);
  } catch (err) {
    console.error('GET artisans error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * Récupère les ventes d'un artisan spécifique avec un résumé.
 * @route GET /api/rapports/:artisan_id
 * @param {number} req.params.artisan_id - L'identifiant numérique de l'artisan.
 * @returns {Object} Données de ventes de l'artisan avec résumé (total_articles, total_montant).
 * @throws {400} Si l'ID de l'artisan est invalide.
 */
router.get('/:artisan_id', async (req, res) => {
  try {
    const artisan_id = parseInt(req.params.artisan_id, 10);

    if (isNaN(artisan_id)) {
      return res.status(400).json({ error: 'ID artisan invalide' });
    }

    const data = await getVentesByArtisan(artisan_id);
    res.json(data);
  } catch (err) {
    console.error('GET rapport artisan error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;