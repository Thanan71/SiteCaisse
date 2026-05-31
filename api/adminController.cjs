/**
 * @module adminController
 * @description Contrôleur d'administration.
 * Permet aux administrateurs de gérer les utilisateurs (liste, création, suppression).
 * Protégé par le middleware d'authentification + vérification du rôle admin.
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const { authMiddleware } = require('./authController.cjs');
const { getSupabase } = require('./db.cjs');

const router = express.Router();

/**
 * Middleware de vérification du rôle admin.
 * Doit être utilisé APRÈS authMiddleware.
 * @param {import('express').Request} req - Requête Express.
 * @param {import('express').Response} res - Réponse Express.
 * @param {import('express').NextFunction} next - Fonction suivante.
 * @returns {void}
 */
function adminMiddleware(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
  }
  next();
}

/**
 * GET /api/admin/users
 * Récupère la liste de tous les utilisateurs.
 * @returns {Array} Tableau des utilisateurs (id, nom, email, role, est_actif, created_at).
 */
router.get('/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('users')
      .select('id, nom, email, role, est_actif, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('Admin list users error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' });
  }
});

/**
 * POST /api/admin/users
 * Crée un nouvel utilisateur.
 * @param {string} req.body.nom - Nom de l'utilisateur.
 * @param {string} req.body.email - Email de l'utilisateur.
 * @param {string} req.body.password - Mot de passe de l'utilisateur.
 * @param {string} req.body.role - Rôle de l'utilisateur ('permanent', 'temporaire').
 * @returns {Object} Utilisateur créé (sans le password_hash).
 */
router.post('/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { nom, email, password, role } = req.body;

    if (!nom || !email || !password || !role) {
      return res.status(400).json({ error: 'Nom, email, mot de passe et rôle requis' });
    }

    if (!['permanent', 'temporaire'].includes(role)) {
      return res.status(400).json({ error: 'Le rôle doit être "permanent" ou "temporaire"' });
    }

    const supabase = getSupabase();

    // Vérifier si l'email existe déjà
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'Un utilisateur avec cet email existe déjà' });
    }

    const password_hash = bcrypt.hashSync(password, 10);

    const { data, error } = await supabase
      .from('users')
      .insert({ nom, email, password_hash, role })
      .select('id, nom, email, role, est_actif, created_at')
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('Admin create user error:', err);
    res.status(500).json({ error: 'Erreur lors de la création de l\'utilisateur' });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Supprime un utilisateur.
 * @param {number} req.params.id - ID de l'utilisateur à supprimer.
 * @returns {Object} Message de confirmation.
 */
router.delete('/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'ID utilisateur invalide' });
    }

    // Empêcher l'admin de se supprimer lui-même
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
    }

    const supabase = getSupabase();

    // Vérifier que l'utilisateur existe
    const { data: userToDelete } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (!userToDelete) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    // Supprimer les ventes liées à cet utilisateur (artisan ou vendeur)
    await supabase.from('ventes').delete().eq('artisan_id', userId);
    await supabase.from('ventes').delete().eq('vendeur_id', userId);

    // Supprimer l'utilisateur
    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) throw error;

    res.json({ message: 'Utilisateur supprimé avec succès' });
  } catch (err) {
    console.error('Admin delete user error:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression de l\'utilisateur' });
  }
});

module.exports = router;