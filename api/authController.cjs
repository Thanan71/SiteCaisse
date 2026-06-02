/**
 * @module authController
 * @description Contrôleur d'authentification.
 * Gère la vérification des tokens Supabase Auth JWT
 * et la récupération du profil de l'utilisateur connecté.
 */
const express = require('express')
const { getSupabase } = require('./db.cjs')
const { findUserById, findUserByEmail } = require('./models.cjs')
const { logAction, logError } = require('./services/loggerService.cjs')

const router = express.Router()

/**
 * Middleware de vérification du token JWT Supabase.
 * Extrait et vérifie le token depuis l'en-tête Authorization (Bearer)
 * via l'API Supabase Auth (auth.getUser).
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
  try {
    const supabase = getSupabase()
    // Vérifier le token via Supabase Auth
    const { data: { user: authUser }, error } = await supabase.auth.getUser(token)

    if (error || !authUser) {
      await logError({
        err: error || new Error('User not found'),
        context: 'auth.middleware',
        cible_type: 'auth',
        details: { reason: 'invalid_or_expired_token' },
        req,
      })
      return res.status(401).json({ error: 'Token invalide ou expiré' })
    }

    // Récupérer les infos utilisateur dans notre table users
    // via le user_id stocké dans user_metadata
    const userId = authUser.user_metadata?.user_id
    if (userId) {
      const user = await findUserById(userId)
      if (user) {
        req.user = user
        next()
        return
      }
    }

    // Fallback : chercher par email
    const userByEmail = await findUserByEmail(authUser.email)
    if (userByEmail) {
      req.user = userByEmail
      next()
      return
    }

    return res.status(401).json({ error: 'Utilisateur non trouvé' })
  } catch (err) {
    void logError({
      err,
      context: 'auth.middleware',
      cible_type: 'auth',
      details: { reason: 'verification_error' },
      req,
    })
    return res.status(401).json({ error: 'Token invalide ou expiré' })
  }
}

/**
 * Route de vérification du profil utilisateur connecté.
 * @route GET /api/auth/me
 * @returns {Object} Informations de l'utilisateur connecté (id, nom, email, role, est_actif).
 * @throws {401} Si le token est manquant ou invalide (via authMiddleware).
 * @throws {404} Si l'utilisateur n'est pas trouvé en base de données.
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    res.json(req.user)
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

module.exports = { router, authMiddleware }