/**
 * @module authController
 * @description Contrôleur d'authentification.
 * Gère la connexion des utilisateurs, la vérification des tokens JWT
 * et la récupération du profil de l'utilisateur connecté.
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { findUserByEmail, findUserById } = require('./models.cjs');
const { logAction } = require('./services/loggerService.cjs');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'sitecaisse-secret-key-2024';

/**
 * Middleware de vérification du token JWT.
 * Extrait et vérifie le token depuis l'en-tête Authorization (Bearer).
 * @param {import('express').Request} req - Requête Express.
 * @param {import('express').Response} res - Réponse Express.
 * @param {import('express').NextFunction} next - Fonction suivante dans la chaîne de middleware.
 * @returns {void}
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

/**
 * Route de connexion : authentifie un utilisateur avec email et mot de passe.
 * @route POST /api/auth/login
 * @param {string} req.body.email - Adresse email de l'utilisateur.
 * @param {string} req.body.password - Mot de passe de l'utilisateur.
 * @returns {Object} Token JWT et informations utilisateur (id, nom, email, role).
 * @throws {400} Si email ou mot de passe manquant.
 * @throws {401} Si email ou mot de passe incorrect.
 * @throws {403} Si le compte est désactivé.
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      await logAction({
        action: 'auth.login_failed',
        cible_type: 'auth',
        details: { email, reason: 'unknown_email' },
        req
      });
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    if (!user.est_actif) {
      await logAction({
        user,
        action: 'auth.login_failed',
        cible_type: 'auth',
        cible_id: user.id,
        details: { reason: 'inactive_account' },
        req
      });
      return res.status(403).json({ error: 'Compte désactivé' });
    }

    // Vérifier si l'utilisateur temporaire a une date de fin dépassée
    if (user.role === 'temporaire' && user.date_fin) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dateFin = new Date(user.date_fin + 'T00:00:00');
      if (dateFin < today) {
        await logAction({
          user,
          action: 'auth.login_failed',
          cible_type: 'auth',
          cible_id: user.id,
          details: { reason: 'expired_access', date_fin: user.date_fin },
          req
        });
        return res.status(403).json({ error: 'Votre accès a expiré. Contactez un administrateur.' });
      }
    }

    const validPassword = bcrypt.compareSync(password, user.password_hash);
    if (!validPassword) {
      await logAction({
        action: 'auth.login_failed',
        cible_type: 'auth',
        details: { email, reason: 'invalid_password' },
        req
      });
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const token = jwt.sign(
      { id: user.id, nom: user.nom, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    await logAction({
      user,
      action: 'auth.login_success',
      cible_type: 'auth',
      cible_id: user.id,
      req
    });

    res.json({
      token,
      user: {
        id: user.id,
        nom: user.nom,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * Route de vérification du profil utilisateur connecté.
 * @route GET /api/auth/me
 * @returns {Object} Informations de l'utilisateur connecté (id, nom, email, role, est_actif).
 * @throws {401} Si le token est manquant ou invalide (via authMiddleware).
 * @throws {404} Si l'utilisateur n'est pas trouvé en base de données.
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    res.json(user);
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = { router, authMiddleware };
