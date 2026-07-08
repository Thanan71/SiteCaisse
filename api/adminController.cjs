/**
 * @module adminController
 * @description Contrôleur d'administration.
 * Permet aux administrateurs de gérer les utilisateurs (liste, création, archivage)
 * ainsi que les paramètres système (commissions CB).
 * Protégé par le middleware d'authentification + vérification du rôle admin.
 */
const express = require('express')
const { authMiddleware } = require('./authController.cjs')
const { getAllParametres, updateParametre } = require('./services/parametresService.cjs')
const { logAction, logError, getActionLogs } = require('./services/loggerService.cjs')
const {
  AdminUserError,
  createUser,
  deactivateUser,
  extendTemporaryUserAccess,
  listUsers,
  reactivateUser,
  resetPasswordForUser,
  updateUserCommission,
} = require('./services/adminUserService.cjs')

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

function sendAdminUserError(err, res) {
  if (!(err instanceof AdminUserError)) return false
  res.status(err.statusCode).json({ error: err.message })
  return true
}

/**
 * GET /api/admin/users
 * Récupère la liste de tous les utilisateurs.
 * @returns {Array} Tableau des utilisateurs (id, nom, nom_boutique, role, est_actif, date_fin, created_at).
 */
router.get('/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    res.json(await listUsers())
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
 * @param {string} req.body.role - Rôle de l'utilisateur ('permanent', 'temporaire').
 * @param {string} [req.body.date_fin] - Date de fin pour les temporaires (format YYYY-MM-DD).
 * @returns {Object} Utilisateur créé (sans le password_hash) et mot de passe généré.
 */
router.post('/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { nom, nom_boutique, role, date_fin } = req.body

    if (!nom || !nom_boutique || !role) {
      return res.status(400).json({ error: 'Nom, nom de boutique et rôle requis' })
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

    const { user, newPassword } = await createUser({
      nom,
      nom_boutique,
      role,
      date_fin,
    })

    await logAction({
      user: req.user,
      action: 'user.create',
      cible_type: 'user',
      cible_id: user.id,
      details: {
        nom: user.nom,
        nom_boutique: user.nom_boutique,
        role: user.role,
        date_fin: user.date_fin,
      },
      req,
    })

    res.status(201).json({
      message: 'Utilisateur créé avec succès.',
      user,
      newPassword,
    })
  } catch (err) {
    if (sendAdminUserError(err, res)) return

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
 * Archive un utilisateur en désactivant son compte.
 * @param {number} req.params.id - ID de l'utilisateur à désactiver.
 * @returns {Object} Message de confirmation.
 */
router.delete('/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10)

    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'ID utilisateur invalide' })
    }

    const userToDeactivate = await deactivateUser(userId, req.user.id)

    await logAction({
      user: req.user,
      action: 'user.deactivate',
      cible_type: 'user',
      cible_id: userId,
      details: {
        nom: userToDeactivate.nom,
        nom_boutique: userToDeactivate.nom_boutique,
        role: userToDeactivate.role,
      },
      req,
    })

    res.json({ message: 'Utilisateur désactivé avec succès' })
  } catch (err) {
    if (sendAdminUserError(err, res)) return

    console.error('Admin deactivate user error:', err)
    await logError({
      user: req.user,
      err,
      context: 'admin.users.deactivate',
      cible_type: 'user',
      cible_id: req.params.id,
      req,
    })
    res.status(500).json({ error: "Erreur lors de la désactivation de l'utilisateur" })
  }
})

/**
 * PATCH /api/admin/users/:id/reactivate
 * Désarchive un utilisateur en réactivant son compte.
 * @param {number} req.params.id - ID de l'utilisateur à réactiver.
 * @returns {Object} Message de confirmation.
 */
router.patch('/users/:id/reactivate', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10)

    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'ID utilisateur invalide' })
    }

    const userToReactivate = await reactivateUser(userId)

    await logAction({
      user: req.user,
      action: 'user.reactivate',
      cible_type: 'user',
      cible_id: userId,
      details: {
        nom: userToReactivate.nom,
        nom_boutique: userToReactivate.nom_boutique,
        role: userToReactivate.role,
      },
      req,
    })

    res.json({ message: 'Utilisateur désarchivé avec succès', user: userToReactivate })
  } catch (err) {
    if (sendAdminUserError(err, res)) return

    console.error('Admin reactivate user error:', err)
    await logError({
      user: req.user,
      err,
      context: 'admin.users.reactivate',
      cible_type: 'user',
      cible_id: req.params.id,
      req,
    })
    res.status(500).json({ error: "Erreur lors de la réactivation de l'utilisateur" })
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

    const { previousUser, user } = await updateUserCommission(
      userId,
      req.body?.commission_cb_personnalisee,
    )

    await logAction({
      user: req.user,
      action: 'user.commission_update',
      cible_type: 'user',
      cible_id: userId,
      details: {
        nom: previousUser.nom,
        nom_boutique: previousUser.nom_boutique,
        ancienne_commission_cb_personnalisee: previousUser.commission_cb_personnalisee,
        nouvelle_commission_cb_personnalisee: user.commission_cb_personnalisee,
      },
      req,
    })

    res.json({
      message: 'Commission personnalisée mise à jour avec succès',
      user,
    })
  } catch (err) {
    if (sendAdminUserError(err, res)) return

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

    const { user, newPassword } = await resetPasswordForUser(userId)

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
    if (sendAdminUserError(err, res)) return

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
    const { user, nouvelleDateFin } = await extendTemporaryUserAccess(userId, date_fin)

    await logAction({
      user: req.user,
      action: 'user.extend',
      cible_type: 'user',
      cible_id: userId,
      details: {
        nom: user.nom,
        nom_boutique: user.nom_boutique,
        ancienne_date: user.date_fin,
        nouvelle_date: nouvelleDateFin,
      },
      req,
    })

    res.json({ message: 'Accès prolongé avec succès', nouvelle_date_fin: nouvelleDateFin })
  } catch (err) {
    if (sendAdminUserError(err, res)) return

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
