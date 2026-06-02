/**
 * @module store/auth
 * @description Store d'authentification Pinia.
 * Gère la connexion et la déconnexion via Supabase Auth.
 */
import { defineStore } from 'pinia'
import api from '../services/api'
import {
  signInWithPassword,
  signOut,
  getSession,
  getUser,
  onAuthStateChange,
} from '../services/supabase'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    /** @property {Object|null} user - Données de l'utilisateur connecté (null si déconnecté). */
    user: null,
    /** @property {string} token - Jeton d'authentification Supabase (access_token). */
    token: '',
    /** @property {boolean} loading - Indique si une vérification de session est en cours. */
    loading: true,
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

    /**
     * Retourne l'email de l'utilisateur connecté.
     * @returns {string} Email de l'utilisateur ou chaîne vide si non connecté.
     */
    userEmail: (state) => state.user?.email || '',
  },

  actions: {
    /**
     * Initialise le store en vérifiant la session Supabase existante.
     * Appelée au démarrage de l'application.
     * @returns {Promise<void>}
     */
    async init() {
      this.loading = true
      try {
        // Écouter les changements de session (rafraîchissement automatique, déconnexion, etc.)
        onAuthStateChange((event, session) => {
          if (session?.access_token) {
            this.token = session.access_token
          } else {
            this.token = ''
            this.user = null
          }
        })

        // Vérifier s'il y a une session active stockée par Supabase
        const { data: sessionData } = await getSession()
        if (sessionData?.session?.access_token) {
          this.token = sessionData.session.access_token
          // Récupérer les infos utilisateur depuis le backend
          await this.fetchUser()
        }
      } catch (error) {
        console.error('Auth init error:', error)
        this.token = ''
        this.user = null
      } finally {
        this.loading = false
      }
    },

    /**
     * Connecte un utilisateur avec ses identifiants via Supabase Auth.
     * Récupère ensuite les informations utilisateur depuis le backend.
     * @param {string} email - Adresse email de l'utilisateur.
     * @param {string} password - Mot de passe de l'utilisateur.
     * @returns {Promise<Object>} Données de l'utilisateur connecté.
     */
    async login(email, password) {
      const { data, error } = await signInWithPassword(email, password)
      if (error) throw error

      if (!data?.session?.access_token) {
        throw new Error('Aucune session créée')
      }

      this.token = data.session.access_token

      // Récupérer les infos utilisateur depuis le backend
      const user = await this.fetchUser()
      return user
    },

    /**
     * Récupère les informations utilisateur depuis le backend
     * en utilisant le token Supabase (JWT) pour l'authentification.
     * Déconnecte automatiquement en cas d'échec.
     * @returns {Promise<Object>} Données de l'utilisateur.
     */
    async fetchUser() {
      try {
        const response = await api.get('/api/auth/me')
        this.user = response.data
        return this.user
      } catch (error) {
        await this.logout()
        throw error
      }
    },

    /**
     * Déconnecte l'utilisateur via Supabase Auth.
     * Vide le store et supprime la session.
     * @returns {Promise<void>}
     */
    async logout() {
      this.token = ''
      this.user = null
      await signOut()
    },
  },
})