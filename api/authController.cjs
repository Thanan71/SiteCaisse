/**
 * @module authController
 * @description Contrôleur d'authentification.
 * Gère la vérification des tokens Supabase Auth JWT
 * et la récupération du profil de l'utilisateur connecté.
 * Lie automatiquement l'auth_id lors du premier login.
 */
const express = require('express')
const { getSupabase } = require('./db.cjs')
const { findUserByEmail } = require('./models.cjs')
const { logAction, logError } = require('./services/loggerService.cjs')

const router = express.Router()

/**
 * Middleware de vérification du token JWT Supabase.
 * Extrait et vérifie le token depuis l'en-tête Authorization (Bearer)
 * via l'API Supabase Auth (auth.getUser).
 * Lie automatiquement l'auth_id au premier appel.
 */
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' })
  }

  const token = authHeader.split(' ')[1]
  try {
    const sb = getSupabase()

    // Vérifier le token via Supabase Auth
    const { data: { user: authUser }, error } = await sb.auth.getUser(token)

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

    // 1. Chercher l'utilisateur par auth_id (liaison déjà existante)
    const { data: userByAuthId } = await sb
      .from('users')
      .select('*')
      .eq('auth_id', authUser.id)
      .maybeSingle()

    if (userByAuthId) {
      req.user = userByAuthId
      next()
      return
    }

    // 2. Chercher par email (première connexion)
    const userByEmail = await findUserByEmail(authUser.email)
    if (userByEmail) {
      // Lier l'auth_id automatiquement
      await sb
        .from('users')
        .update({ auth_id: authUser.id })
        .eq('id', userByEmail.id)

      userByEmail.auth_id = authUser.id
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