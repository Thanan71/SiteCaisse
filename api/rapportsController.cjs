/**
 * @module rapportsController
 * @description Contrôleur de gestion des rapports.
 * Fournit les routes pour récupérer la liste des artisans
 * et les ventes détaillées d'un artisan spécifique.
 * Toutes les routes sont protégées par le middleware d'authentification JWT.
 */
const express = require('express');
const { getAllArtisans, getVentesByArtisan, getAllVentesGroupedByArtisan, getAllParametres } = require('./models.cjs');
const { authMiddleware } = require('./authController.cjs');

const router = express.Router();

router.use(authMiddleware);

/**
 * Calcule les commissions CB pour un groupe de ventes.
 * @param {Array} ventes - Les ventes d'un artisan.
 * @param {number} tauxCommission - Le taux de commission en pourcentage.
 * @returns {{total_cb: number, commission_cb: number}}
 */
function calculerCommissionsCB(ventes, tauxCommission) {
  const totalCB = ventes
    .filter(v => v.type_paiement === 'CB')
    .reduce((sum, v) => sum + (v.prix || 0) * (v.quantite || 0), 0);
  
  const commission = totalCB * (tauxCommission / 100);
  
  return { total_cb: totalCB, commission_cb: Math.round(commission * 100) / 100 };
}

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

    let totalGlobalCB = 0;
    let totalGlobalCommission = 0;

    // Ajouter les commissions CB pour chaque groupe
    const groupesAvecCommissions = data.groupes.map(g => {
      // Déterminer le taux selon le rôle (on prend le rôle de la première vente)
      const role = g.ventes[0]?.artisan_role || 'permanent';
      const taux = role === 'temporaire' ? tauxTemporaire : tauxPermanent;
      
      const cb = calculerCommissionsCB(g.ventes, taux);
      totalGlobalCB += cb.total_cb;
      totalGlobalCommission += cb.commission_cb;

      return {
        ...g,
        summary: {
          ...g.summary,
          total_cb: cb.total_cb,
          commission_cb: cb.commission_cb,
          taux_commission: taux
        }
      };
    });

    res.json({
      groupes: groupesAvecCommissions,
      total: {
        ...data.total,
        total_cb: totalGlobalCB,
        total_commission: Math.round(totalGlobalCommission * 100) / 100
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

    // Déterminer le rôle de l'artisan depuis les ventes
    const role = data.ventes[0]?.artisan_role || 'permanent';
    const taux = role === 'temporaire' 
      ? parseFloat(parametres.commission_cb_temporaire) 
      : parseFloat(parametres.commission_cb_permanent);
    
    const cb = calculerCommissionsCB(data.ventes, taux || 0);

    res.json({
      ...data,
      summary: {
        ...data.summary,
        total_cb: cb.total_cb,
        commission_cb: cb.commission_cb,
        taux_commission: taux || 0
      }
    });
  } catch (err) {
    console.error('GET rapport artisan error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;