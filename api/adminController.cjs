/**
 * @module adminController
 * @description Contrôleur d'administration.
 * Permet aux administrateurs de gérer les utilisateurs (liste, création, suppression)
 * ainsi que les paramètres système (commissions CB).
 * Protégé par le middleware d'authentification + vérification du rôle admin.
 */
const express = require('express')
const bcrypt = require('bcryptjs')
const crypto = require('node:crypto')
const { authMiddleware } = require('./authController.cjs')
const { getSupabase } = require('./db.cjs')
const { getAllParametres, updateParametre } = require('./services/parametresService.cjs')
const { logAction, logError, getActionLogs } = require('./services/loggerService.cjs')
const { extendUserDateFin, resetUserPassword } = require('./models.cjs')

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

function normalizePasswordBase(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function generateResetPassword(nomBoutique) {
  const base = normalizePasswordBase(nomBoutique) || 'boutique'
  const suffix = crypto.randomInt(0, 10000).toString().padStart(4, '0')
  return `${base}${suffix}`
}

function parseOptionalPositiveNumber(value) {
  if (value === undefined || value === null) return null

  const normalized = typeof value === 'string' ? value.trim().replace(',', '.') : value
  if (normalized === '') return null

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) return undefined

  return parsed
}

/**
 * GET /api/admin/users
 * Récupère la liste de tous les utilisateurs.
 * @returns {Array} Tableau des utilisateurs (id, nom, nom_boutique, role, est_actif, date_fin, created_at).
 */
router.get('/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('users')
      .select(
        'id, nom, nom_boutique, generated_password, commission_cb_personnalisee, role, est_actif, date_fin, created_at',
      )
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
 * @param {string} req.body.nom_boutique - Nom de boutique de l'utilisateur.
 * @param {string} req.body.password - Mot de passe de l'utilisateur.
 * @param {string} req.body.role - Rôle de l'utilisateur ('permanent', 'temporaire').
 * @param {string} [req.body.date_fin] - Date de fin pour les temporaires (format YYYY-MM-DD).
 * @returns {Object} Utilisateur créé (sans le password_hash).
 */
router.post('/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { nom, nom_boutique, password, role, date_fin } = req.body

    if (!nom || !nom_boutique || !password || !role) {
      return res.status(400).json({ error: 'Nom, nom de boutique, mot de passe et rôle requis' })
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

    // Vérifier si le nom de boutique existe déjà
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('nom_boutique', nom_boutique)
      .maybeSingle()

    if (existing) {
      return res.status(409).json({ error: 'Un utilisateur avec ce nom de boutique existe déjà' })
    }

    const password_hash = bcrypt.hashSync(password, 10)

    const userData = {
      nom,
      nom_boutique,
      password_hash,
      generated_password: password,
      role,
      password_change_required: 1,
    }
    if (date_fin) {
      userData.date_fin = date_fin
    }

    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select(
        'id, nom, nom_boutique, role, est_actif, date_fin, created_at, password_change_required',
      )
      .single()

    if (error) throw error
    await logAction({
      user: req.user,
      action: 'user.create',
      cible_type: 'user',
      cible_id: data.id,
      details: {
        nom: data.nom,
        nom_boutique: data.nom_boutique,
        role: data.role,
        date_fin: data.date_fin,
      },
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
        nom_boutique: req.body?.nom_boutique || null,
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
      .select('id, nom, nom_boutique, role')
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
      details: {
        nom: userToDelete.nom,
        nom_boutique: userToDelete.nom_boutique,
        role: userToDelete.role,
      },
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
 * PATCH /api/admin/users/:id/commission
 * Met à jour le taux de commission CB personnalisé d'un utilisateur.
 * Une valeur vide ou null retire la personnalisation et réactive le taux général.
 */
router.patch('/users/:id/commission', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10)

    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'ID utilisateur invalide' })
    }

    const commissionCbPersonnalisee = parseOptionalPositiveNumber(
      req.body?.commission_cb_personnalisee,
    )
    if (commissionCbPersonnalisee === undefined) {
      return res
        .status(400)
        .json({ error: 'La commission personnalisée doit être un nombre positif' })
    }

    const supabase = getSupabase()

    const { data: user } = await supabase
      .from('users')
      .select('id, nom, nom_boutique, role, commission_cb_personnalisee')
      .eq('id', userId)
      .maybeSingle()

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' })
    }

    if (user.role === 'admin') {
      return res
        .status(400)
        .json({ error: 'Les commissions personnalisées ne concernent que les artisans' })
    }

    const { data, error } = await supabase
      .from('users')
      .update({ commission_cb_personnalisee: commissionCbPersonnalisee })
      .eq('id', userId)
      .select('id, nom, nom_boutique, role, commission_cb_personnalisee')
      .single()

    if (error) throw error

    await logAction({
      user: req.user,
      action: 'user.commission_update',
      cible_type: 'user',
      cible_id: userId,
      details: {
        nom: user.nom,
        nom_boutique: user.nom_boutique,
        ancienne_commission_cb_personnalisee: user.commission_cb_personnalisee,
        nouvelle_commission_cb_personnalisee: data.commission_cb_personnalisee,
      },
      req,
    })

    res.json({
      message: 'Commission personnalisée mise à jour avec succès',
      user: data,
    })
  } catch (err) {
    console.error('Admin update user commission error:', err)
    await logError({
      user: req.user,
      err,
      context: 'admin.users.commission_update',
      cible_type: 'user',
      cible_id: req.params.id,
      req,
    })
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la commission' })
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

/**
 * POST /api/admin/users/:id/reset-password
 * Réinitialise le mot de passe d'un utilisateur.
 * Génère un mot de passe à partir du nom de boutique et de 4 chiffres aléatoires.
 * @param {number} req.params.id - ID de l'utilisateur.
 * @returns {Object} Message de confirmation.
 */
router.post('/users/:id/reset-password', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10)

    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'ID utilisateur invalide' })
    }

    const supabase = getSupabase()

    // Vérifier que l'utilisateur existe
    const { data: user } = await supabase
      .from('users')
      .select('id, nom, nom_boutique')
      .eq('id', userId)
      .maybeSingle()

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' })
    }

    const newPassword = await resetUserPassword(userId, generateResetPassword(user.nom_boutique))

    await logAction({
      user: req.user,
      action: 'user.password_reset',
      cible_type: 'user',
      cible_id: userId,
      details: { nom: user.nom, nom_boutique: user.nom_boutique },
      req,
    })

    res.json({
      message: 'Mot de passe réinitialisé avec succès.',
      newPassword,
    })
  } catch (err) {
    console.error('Admin reset password error:', err)
    await logError({
      user: req.user,
      err,
      context: 'admin.users.reset_password',
      cible_type: 'user',
      cible_id: req.params.id,
      req,
    })
    res.status(500).json({ error: 'Erreur lors de la réinitialisation du mot de passe' })
  }
})

/**
 * PATCH /api/admin/users/:id/extend
 * Prolonge la date de fin d'accès d'un utilisateur temporaire.
 * @param {number} req.params.id - ID de l'utilisateur.
 * @param {string} req.body.date_fin - Nouvelle date de fin (YYYY-MM-DD).
 * @returns {Object} Message de confirmation.
 */
router.patch('/users/:id/extend', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10)

    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'ID utilisateur invalide' })
    }

    const { date_fin } = req.body
    if (!date_fin) {
      return res.status(400).json({ error: 'La nouvelle date de fin est requise' })
    }

    const supabase = getSupabase()

    // Vérifier que l'utilisateur existe et est temporaire
    const { data: user } = await supabase
      .from('users')
      .select('id, nom, nom_boutique, role, date_fin')
      .eq('id', userId)
      .maybeSingle()

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' })
    }

    if (user.role !== 'temporaire') {
      return res
        .status(400)
        .json({ error: 'Seuls les utilisateurs temporaires peuvent être prolongés' })
    }

    // Valider que la nouvelle date est postérieure à l'ancienne
    const oldDate = new Date(user.date_fin)
    const newDate = new Date(date_fin)
    if (newDate <= oldDate) {
      return res
        .status(400)
        .json({ error: 'La nouvelle date de fin doit être postérieure à la date actuelle' })
    }

    await extendUserDateFin(userId, date_fin)

    await logAction({
      user: req.user,
      action: 'user.extend',
      cible_type: 'user',
      cible_id: userId,
      details: {
        nom: user.nom,
        nom_boutique: user.nom_boutique,
        ancienne_date: user.date_fin,
        nouvelle_date: date_fin,
      },
      req,
    })

    res.json({ message: 'Accès prolongé avec succès', nouvelle_date_fin: date_fin })
  } catch (err) {
    console.error('Admin extend user error:', err)
    await logError({
      user: req.user,
      err,
      context: 'admin.users.extend',
      cible_type: 'user',
      cible_id: req.params.id,
      req,
    })
    res.status(500).json({ error: "Erreur lors de la prolongation de l'accès" })
  }
})

module.exports = router
