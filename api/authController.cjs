/**
 * @module authController
 * @description Contrôleur d'authentification.
 * Gère la vérification des tokens Supabase Auth JWT
 * et la récupération du profil de l'utilisateur connecté.
 */
const express = require('express')
const { getSupabase } = require('./db.cjs')
const { findUserById } = require('./models.cjs')
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

    // Récupérer les infos utilisateur de notre base (id, nom, email, role)
    const userId = authUser.user_metadata?.user_id
    if (userId) {
      const user = await findUserById(userId)
      if (user) {
        req.user = user
        next()
        return
      }
    }

    // Fallback : créer un objet minimal avec les infos Supabase
    req.user = {
      id: authUser.user_metadata?.user_id || null,
      auth_id: authUser.id,
      email: authUser.email,
      nom: authUser.user_metadata?.nom || authUser.email,
      role: authUser.user_metadata?.role || 'permanent',
    }
    next()
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
    // Si nous avons un userId valide, chercher en base
    if (req.user.id) {
      const user = await findUserById(req.user.id)
      if (user) {
        res.json(user)
        return
      }
    }
    // Sinon retourner les infos du token Supabase
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