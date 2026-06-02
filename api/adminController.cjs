/**
 * @module adminController
 * @description Contrôleur d'administration.
 * Permet aux administrateurs de gérer les utilisateurs (liste, création, suppression)
 * ainsi que les paramètres système (commissions CB).
 * Protégé par le middleware d'authentification + vérification du rôle admin.
 */
const express = require('express')
const bcrypt = require('bcryptjs')
const { authMiddleware } = require('./authController.cjs')
const { getSupabase } = require('./db.cjs')
const { getAllParametres, updateParametre } = require('./services/parametresService.cjs')
const { logAction, logError, getActionLogs } = require('./services/loggerService.cjs')

const router = express.Router()

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
    return res.status(403).json({ error: 'Accès réservé aux administrateurs' })
  }
  next()
}

/**
 * GET /api/admin/users
 * Récupère la liste de tous les utilisateurs.
 * @returns {Array} Tableau des utilisateurs (id, nom, email, role, est_actif, date_fin, created_at).
 */
router.get('/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('users')
      .select('id, nom, email, role, est_actif, date_fin, created_at')
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(data || [])
  } catch (err) {
    console.error('Admin list users error:', err)
    await logError({
      user: req.user,
      err,
      context: 'admin.users.list',
      cible_type: 'user',
      req,
    })
    res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' })
  }
})

/**
 * POST /api/admin/users
 * Crée un nouvel utilisateur.
 * @param {string} req.body.nom - Nom de l'utilisateur.
 * @param {string} req.body.email - Email de l'utilisateur.
 * @param {string} req.body.password - Mot de passe de l'utilisateur.
 * @param {string} req.body.role - Rôle de l'utilisateur ('permanent', 'temporaire').
 * @param {string} [req.body.date_fin] - Date de fin pour les temporaires (format YYYY-MM-DD).
 * @returns {Object} Utilisateur créé (sans le password_hash).
 */
router.post('/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { nom, email, password, role, date_fin } = req.body

    if (!nom || !email || !password || !role) {
      return res.status(400).json({ error: 'Nom, email, mot de passe et rôle requis' })
    }

    if (!['permanent', 'temporaire'].includes(role)) {
      return res.status(400).json({ error: 'Le rôle doit être "permanent" ou "temporaire"' })
    }

    // Si le rôle est temporaire, une date de fin est obligatoire
    if (role === 'temporaire' && !date_fin) {
      return res
        .status(400)
        .json({ error: 'Une date de fin est requise pour les utilisateurs temporaires' })
    }

    // Si le rôle est permanent, pas de date de fin
    if (role === 'permanent' && date_fin) {
      return res
        .status(400)
        .json({ error: 'Un utilisateur permanent ne peut pas avoir de date de fin' })
    }

    const supabase = getSupabase()

    // Vérifier si l'email existe déjà
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existing) {
      return res.status(409).json({ error: 'Un utilisateur avec cet email existe déjà' })
    }

    const password_hash = bcrypt.hashSync(password, 10)

    const userData = { nom, email, password_hash, role, password_change_required: 1 }
    if (date_fin) {
      userData.date_fin = date_fin
    }

    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select('id, nom, email, role, est_actif, date_fin, created_at, password_change_required')
      .single()

    if (error) throw error
    await logAction({
      user: req.user,
      action: 'user.create',
      cible_type: 'user',
      cible_id: data.id,
      details: { nom: data.nom, email: data.email, role: data.role, date_fin: data.date_fin },
      req,
    })
    res.status(201).json(data)
  } catch (err) {
    console.error('Admin create user error:', err)
    await logError({
      user: req.user,
      err,
      context: 'admin.users.create',
      cible_type: 'user',
      details: {
        nom: req.body?.nom || null,
        email: req.body?.email || null,
        role: req.body?.role || null,
        date_fin: req.body?.date_fin || null,
      },
      req,
    })
    res.status(500).json({ error: "Erreur lors de la création de l'utilisateur" })
  }
})

/**
 * DELETE /api/admin/users/:id
 * Supprime un utilisateur.
 * @param {number} req.params.id - ID de l'utilisateur à supprimer.
 * @returns {Object} Message de confirmation.
 */
router.delete('/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10)

    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'ID utilisateur invalide' })
    }

    // Empêcher l'admin de se supprimer lui-même
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' })
    }

    const supabase = getSupabase()

    // Vérifier que l'utilisateur existe
    const { data: userToDelete } = await supabase
      .from('users')
      .select('id, nom, email, role')
      .eq('id', userId)
      .maybeSingle()

    if (!userToDelete) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' })
    }

    // Supprimer les ventes liées à cet utilisateur (artisan ou vendeur)
    await supabase.from('ventes').delete().eq('artisan_id', userId)
    await supabase.from('ventes').delete().eq('vendeur_id', userId)

    // Supprimer l'utilisateur
    const { error } = await supabase.from('users').delete().eq('id', userId)
    if (error) throw error

    await logAction({
      user: req.user,
      action: 'user.delete',
      cible_type: 'user',
      cible_id: userId,
      details: { nom: userToDelete.nom, email: userToDelete.email, role: userToDelete.role },
      req,
    })

    res.json({ message: 'Utilisateur supprimé avec succès' })
  } catch (err) {
    console.error('Admin delete user error:', err)
    await logError({
      user: req.user,
      err,
      context: 'admin.users.delete',
      cible_type: 'user',
      cible_id: req.params.id,
      req,
    })
    res.status(500).json({ error: "Erreur lors de la suppression de l'utilisateur" })
  }
})

/**
 * GET /api/admin/parametres
 * Récupère tous les paramètres système.
 * @returns {Object} Objet des paramètres (clé -> valeur).
 */
router.get('/parametres', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const params = await getAllParametres()
    res.json(params)
  } catch (err) {
    console.error('Admin get parametres error:', err)
    await logError({
      user: req.user,
      err,
      context: 'admin.parametres.list',
      cible_type: 'parametre',
      req,
    })
    res.status(500).json({ error: 'Erreur lors de la récupération des paramètres' })
  }
})

/**
 * PUT /api/admin/parametres/:cle
 * Met à jour la valeur d'un paramètre système.
 * @param {string} req.params.cle - La clé du paramètre.
 * @param {string} req.body.valeur - La nouvelle valeur.
 * @returns {Object} Message de confirmation.
 */
router.put('/parametres/:cle', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { cle } = req.params
    const { valeur } = req.body

    if (valeur === undefined || valeur === '') {
      return res.status(400).json({ error: 'La valeur est requise' })
    }

    // Valider que la valeur est un nombre positif
    const numVal = parseFloat(valeur)
    if (Number.isNaN(numVal) || numVal < 0) {
      return res.status(400).json({ error: 'La valeur doit être un nombre positif' })
    }

    await updateParametre(cle, valeur)
    await logAction({
      user: req.user,
      action: 'parametre.update',
      cible_type: 'parametre',
      cible_id: cle,
      details: { cle, valeur },
      req,
    })
    res.json({ message: 'Paramètre mis à jour avec succès' })
  } catch (err) {
    console.error('Admin update parametre error:', err)
    await logError({
      user: req.user,
      err,
      context: 'admin.parametres.update',
      cible_type: 'parametre',
      cible_id: req.params.cle,
      req,
    })
    res.status(500).json({ error: 'Erreur lors de la mise à jour du paramètre' })
  }
})

/**
 * GET /api/admin/logs
 * Récupère le journal des actions.
 * @returns {Object} Logs paginés.
 */
router.get('/logs', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await getActionLogs({
      page: req.query.page,
      limit: req.query.limit,
      action: req.query.action || undefined,
      cible_type: req.query.cible_type || undefined,
    })
    res.json(result)
  } catch (err) {
    console.error('Admin get logs error:', err)
    await logError({
      user: req.user,
      err,
      context: 'admin.logs.list',
      cible_type: 'log',
      req,
    })
    res.status(500).json({ error: 'Erreur lors de la récupération des logs' })
  }
})

module.exports = router
