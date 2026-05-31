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
const { ajouterCommissionsAuxGroupes, ajouterCommissionAUnArtisan } = require('./services/commissionService.cjs');
const { getAllParametres } = require('./services/parametresService.cjs');

const router = express.Router();

router.use(authMiddleware);

/**
 * Récupère les ventes de tous les artisans groupées par artisan.
 * @route GET /api/rapports
 * @returns {Object} Groupes de ventes par artisan avec résumé global et commissions CB.
 */
router.get('/', async (req, res) => {
  try {
    const [data, parametres] = await Promise.all([
      getAllVentesGroupedByArtisan(),
      getAllParametres()
    ]);

    const tauxPermanent = parseFloat(parametres.commission_cb_permanent) || 0;
    const tauxTemporaire = parseFloat(parametres.commission_cb_temporaire) || 0;

    // Déléguer le calcul des commissions au service dédié (SRP)
    const { groupesAvecCommissions, totalGlobalCB, totalGlobalCommission } = 
      ajouterCommissionsAuxGroupes(data.groupes, tauxPermanent, tauxTemporaire);

    res.json({
      groupes: groupesAvecCommissions,
      total: {
        ...data.total,
        total_cb: totalGlobalCB,
        total_commission: totalGlobalCommission
      },
      parametres: {
        commission_cb_permanent: tauxPermanent,
        commission_cb_temporaire: tauxTemporaire
      }
    });
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
 * Récupère les ventes d'un artisan spécifique avec un résumé et les commissions CB.
 * @route GET /api/rapports/:artisan_id
 * @param {number} req.params.artisan_id - L'identifiant numérique de l'artisan.
 * @returns {Object} Données de ventes de l'artisan avec résumé et commission CB.
 * @throws {400} Si l'ID de l'artisan est invalide.
 */
router.get('/:artisan_id', async (req, res) => {
  try {
    const artisan_id = parseInt(req.params.artisan_id, 10);

    if (isNaN(artisan_id)) {
      return res.status(400).json({ error: 'ID artisan invalide' });
    }

    const [data, parametres] = await Promise.all([
      getVentesByArtisan(artisan_id),
      getAllParametres()
    ]);

    const tauxPermanent = parseFloat(parametres.commission_cb_permanent) || 0;
    const tauxTemporaire = parseFloat(parametres.commission_cb_temporaire) || 0;

    // Déterminer le rôle de l'artisan depuis les ventes
    const role = data.ventes[0]?.artisan_role || 'permanent';

    // Déléguer le calcul des commissions au service dédié (SRP)
    const resultat = ajouterCommissionAUnArtisan(data, role, tauxPermanent, tauxTemporaire);

    res.json(resultat);
  } catch (err) {
    console.error('GET rapport artisan error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;