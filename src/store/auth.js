/**
 * @module store/auth
 * @description Store d'authentification Pinia.
 * Gère la connexion, la déconnexion et la vérification du token JWT.
 */
import { defineStore } from 'pinia'
import api from '../services/api'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    /** @property {Object|null} user - Données de l'utilisateur connecté (null si déconnecté). */
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    /** @property {string} token - Jeton d'authentification JWT. */
    token: localStorage.getItem('token') || '',
  }),

  getters: {
    /**
     * Vérifie si un utilisateur est authentifié.
     * @returns {boolean} true si un token est présent, false sinon.
     */
    isAuthenticated: (state) => !!state.token,

    /**
     * Vérifie si l'utilisateur connecté est un permanent.
     * @returns {boolean} true si le rôle est 'permanent', false sinon.
     */
    isPermanent: (state) => state.user?.role === 'permanent',

    /**
     * Vérifie si l'utilisateur connecté est un administrateur.
     * @returns {boolean} true si le rôle est 'admin', false sinon.
     */
    isAdmin: (state) => state.user?.role === 'admin',

    /**
     * Retourne le nom de l'utilisateur connecté.
     * @returns {string} Nom de l'utilisateur ou chaîne vide si non connecté.
     */
    userName: (state) => state.user?.nom || '',
  },

  actions: {
    /**
     * Connecte un utilisateur avec ses identifiants.
     * Enregistre le token et les données utilisateur dans le store et le localStorage.
     * @param {string} email - Adresse email de l'utilisateur.
     * @param {string} password - Mot de passe de l'utilisateur.
     * @returns {Promise<Object>} Données de l'utilisateur connecté.
     */
    async login(email, password) {
      const response = await api.post('/api/auth/login', { email, password })
      const { token, user } = response.data

      this.token = token
      this.user = user

      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))

      return user
    },

    /**
     * Vérifie la validité du token JWT auprès du serveur.
     * Met à jour les informations utilisateur. Déconnecte automatiquement en cas d'échec.
     * @returns {Promise<void>}
     */
    async fetchUser() {
      try {
        const response = await api.get('/api/auth/me')
        this.user = response.data
        localStorage.setItem('user', JSON.stringify(this.user))
      } catch (error) {
        this.logout()
        throw error
      }
    },

    /**
     * Déconnecte l'utilisateur.
     * Vide le store et supprime le token et les données du localStorage.
     * @returns {void}
     */
    logout() {
      this.token = ''
      this.user = null
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    },
  },
})
