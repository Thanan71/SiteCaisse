const express = require('express');
const { getAllVentes, createVente, updateVente, deleteVente } = require('./models.cjs');
const { authMiddleware } = require('./authController.cjs');

const router = express.Router();

// Toutes les routes nécessitent une authentification
router.use(authMiddleware);

// GET /api/ventes - Liste toutes les ventes
router.get('/', async (req, res) => {
  try {
    const ventes = await getAllVentes();
    res.json(ventes);
  } catch (err) {
    console.error('GET ventes error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/ventes - Créer une vente
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

// PUT /api/ventes/:id - Modifier une vente
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

// DELETE /api/ventes/:id - Supprimer une vente
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