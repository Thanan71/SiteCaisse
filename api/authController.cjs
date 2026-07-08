/**
 * @module authController
 * @description Contrôleur d'authentification.
 * Gère la connexion des utilisateurs, la vérification des tokens JWT
 * et la récupération du profil de l'utilisateur connecté.
 */
const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { findUserByNomBoutique, findUserById, updatePassword } = require('./models.cjs')
const { logAction, logError } = require('./services/loggerService.cjs')

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || 'sitecaisse-secret-key-2024'

/**
 * Middleware de vérification du token JWT.
 * Extrait et vérifie le token depuis l'en-tête Authorization (Bearer).
 * @param {import('express').Request} req - Requête Express.
 * @param {import('express').Response} res - Réponse Express.
 * @param {import('express').NextFunction} next - Fonction suivante dans la chaîne de middleware.
 * @returns {void}
 */
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' })
  }

  const token = authHeader.split(' ')[1]
  let decoded

  try {
    decoded = jwt.verify(token, JWT_SECRET)
  } catch (err) {
    void logError({
      err,
      context: 'auth.middleware',
      cible_type: 'auth',
      details: { reason: 'invalid_or_expired_token' },
      req,
    })
    return res.status(401).json({ error: 'Token invalide ou expiré' })
  }

  try {
    const user = await findUserById(decoded.id)

    if (!user) {
      return res.status(401).json({ error: 'Utilisateur introuvable' })
    }

    if (!user.est_actif) {
      await logAction({
        user,
        action: 'auth.token_refused',
        cible_type: 'auth',
        cible_id: user.id,
        details: { reason: 'inactive_account' },
        req,
      })
      return res.status(403).json({ error: 'Compte désactivé' })
    }

    req.user = {
      id: user.id,
      nom: user.nom,
      nom_boutique: user.nom_boutique,
      role: user.role,
    }
    next()
  } catch (err) {
    await logError({
      err,
      context: 'auth.middleware.user_lookup',
      cible_type: 'auth',
      cible_id: decoded?.id || null,
      req,
    })
    return res.status(500).json({ error: 'Erreur serveur' })
  }
}

/**
 * Route de connexion : authentifie un utilisateur avec le nom de boutique et mot de passe.
 * @route POST /api/auth/login
 * @param {string} req.body.nom_boutique - Nom de boutique de l'utilisateur.
 * @param {string} req.body.password - Mot de passe de l'utilisateur.
 * @returns {Object} Token JWT et informations utilisateur (id, nom, nom_boutique, role).
 * @throws {400} Si nom de boutique ou mot de passe manquant.
 * @throws {401} Si nom de boutique ou mot de passe incorrect.
 * @throws {403} Si le compte est désactivé.
 */
router.post('/login', async (req, res) => {
  try {
    const { nom_boutique, password } = req.body
    const identifiant = nom_boutique

    if (!identifiant || !password) {
      return res.status(400).json({ error: 'Nom de boutique et mot de passe requis' })
    }

    const user = await findUserByNomBoutique(identifiant)
    if (!user) {
      await logAction({
        action: 'auth.login_failed',
        cible_type: 'auth',
        details: { nom_boutique: identifiant, reason: 'unknown_shop' },
        req,
      })
      return res.status(401).json({ error: 'Nom de boutique ou mot de passe incorrect' })
    }

    if (!user.est_actif) {
      await logAction({
        user,
        action: 'auth.login_failed',
        cible_type: 'auth',
        cible_id: user.id,
        details: { reason: 'inactive_account' },
        req,
      })
      return res.status(403).json({ error: 'Compte désactivé' })
    }

    // Vérifier si l'utilisateur temporaire a une date de fin dépassée
    if (user.role === 'temporaire' && user.date_fin) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const dateFin = new Date(`${user.date_fin}T00:00:00`)
      if (dateFin < today) {
        await logAction({
          user,
          action: 'auth.login_failed',
          cible_type: 'auth',
          cible_id: user.id,
          details: { reason: 'expired_access', date_fin: user.date_fin },
          req,
        })
        return res.status(403).json({ error: 'Votre accès a expiré. Contactez un administrateur.' })
      }
    }

    const validPassword = bcrypt.compareSync(password, user.password_hash)
    if (!validPassword) {
      await logAction({
        action: 'auth.login_failed',
        cible_type: 'auth',
        details: { nom_boutique: identifiant, reason: 'invalid_password' },
        req,
      })
      return res.status(401).json({ error: 'Nom de boutique ou mot de passe incorrect' })
    }

    const token = jwt.sign(
      { id: user.id, nom: user.nom, nom_boutique: user.nom_boutique, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' },
    )

    await logAction({
      user,
      action: 'auth.login_success',
      cible_type: 'auth',
      cible_id: user.id,
      req,
    })

    res.json({
      token,
      password_change_required: Boolean(user.password_change_required),
      user: {
        id: user.id,
        nom: user.nom,
        nom_boutique: user.nom_boutique,
        role: user.role,
        password_change_required: Boolean(user.password_change_required),
      },
    })
  } catch (err) {
    console.error('Login error:', err)
    await logError({
      err,
      context: 'auth.login',
      cible_type: 'auth',
      details: { nom_boutique: req.body?.nom_boutique || null },
      req,
    })
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

/**
 * Route de vérification du profil utilisateur connecté.
 * @route GET /api/auth/me
 * @returns {Object} Informations de l'utilisateur connecté (id, nom, nom_boutique, role, est_actif).
 * @throws {401} Si le token est manquant ou invalide (via authMiddleware).
 * @throws {404} Si l'utilisateur n'est pas trouvé en base de données.
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await findUserById(req.user.id)
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' })
    }
    res.json(user)
  } catch (err) {
    console.error('Me error:', err)
    await logError({
      user: req.user,
      err,
      context: 'auth.me',
      cible_type: 'auth',
      cible_id: req.user?.id || null,
      req,
    })
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

/**
 * Route de changement de mot de passe.
 * @route POST /api/auth/change-password
 * @param {string} req.body.currentPassword - Mot de passe actuel.
 * @param {string} req.body.newPassword - Nouveau mot de passe.
 * @returns {Object} Message de confirmation.
 * @throws {400} Si les mots de passe sont manquants ou identiques.
 * @throws {401} Si le mot de passe actuel est incorrect.
 */
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { newPassword, currentPassword } = req.body

    if (!newPassword) {
      return res.status(400).json({ error: 'Nouveau mot de passe requis' })
    }

    if (newPassword.length < 4) {
      return res
        .status(400)
        .json({ error: 'Le nouveau mot de passe doit contenir au moins 4 caractères' })
    }

    const user = await findUserById(req.user.id)
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' })
    }

    // Si l'utilisateur n'est pas en changement obligatoire, vérifier l'ancien mot de passe
    if (!user.password_change_required) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Mot de passe actuel requis' })
      }

      if (currentPassword === newPassword) {
        return res
          .status(400)
          .json({ error: 'Le nouveau mot de passe doit être différent du mot de passe actuel' })
      }

      const validPassword = bcrypt.compareSync(currentPassword, user.password_hash)
      if (!validPassword) {
        return res.status(401).json({ error: 'Mot de passe actuel incorrect' })
      }
    }

    await updatePassword(req.user.id, newPassword)

    await logAction({
      user: { id: req.user.id, nom: req.user.nom, nom_boutique: req.user.nom_boutique },
      action: 'auth.password_changed',
      cible_type: 'auth',
      cible_id: req.user.id,
      req,
    })

    res.json({ message: 'Mot de passe modifié avec succès' })
  } catch (err) {
    console.error('Change password error:', err)
    await logError({
      user: req.user,
      err,
      context: 'auth.change_password',
      cible_type: 'auth',
      cible_id: req.user?.id || null,
      req,
    })
    res.status(500).json({ error: 'Erreur lors du changement de mot de passe' })
  }
})

module.exports = { router, authMiddleware }
