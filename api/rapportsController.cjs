const express = require('express');
const { getAllArtisans, getVentesByArtisan } = require('./models.cjs');
const { authMiddleware } = require('./authController.cjs');

const router = express.Router();

router.use(authMiddleware);

// GET /api/rapports/artisans - Liste des artisans pour le menu déroulant
router.get('/artisans', async (req, res) => {
  try {
    const artisans = await getAllArtisans();
    res.json(artisans);
  } catch (err) {
    console.error('GET artisans error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/rapports/:artisan_id - Ventes d'un artisan spécifique
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