/**
 * @module services/api
 * @description Service de configuration Axios.
 * Centralise la configuration du client HTTP et les intercepteurs
 * pour l'authentification via token Supabase et la gestion des erreurs 401.
 *
 * Ce service exporte une instance Axios dédiée plutôt que de
 * modifier le module global, respectant ainsi le principe
 * d'inversion des dépendances (DIP).
 */
import axios from 'axios'

/**
 * Crée une instance Axios dédiée à l'application.
 * Cela évite de polluer le module axios global (DIP)
 * et permet une meilleure testabilité.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
})

/**
 * Récupère le token d'accès Supabase depuis le localStorage.
 * Supabase stocke la session dans localStorage avec la clé 'sitecaisse-auth'.
 * @returns {string|null} Le token d'accès ou null si non connecté.
 */
function getSupabaseToken() {
  try {
    const authStorage = localStorage.getItem('sitecaisse-auth')
    if (authStorage) {
      const parsed = JSON.parse(authStorage)
      return parsed?.access_token || null
    }
    return null
  } catch {
    return null
  }
}

/**
 * Intercepteur de requête : ajoute automatiquement le token Supabase
 * à chaque requête sortante.
 * @param {import('axios').InternalAxiosRequestConfig} config - Configuration de la requête.
 * @returns {import('axios').InternalAxiosRequestConfig} Configuration modifiée avec le token.
 */
api.interceptors.request.use((config) => {
  const token = getSupabaseToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/**
 * Intercepteur de réponse : gère les erreurs 401.
 * Déconnecte automatiquement l'utilisateur si le token est expiré ou invalide.
 * @param {import('axios').AxiosResponse} response - Réponse réussie.
 * @returns {import('axios').AxiosResponse} Réponse non modifiée.
 * @param {import('axios').AxiosError} error - Erreur de la requête.
 * @returns {Promise<never>} Erreur propagée après nettoyage de la session.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Ne pas rediriger si on est déjà sur la page de login
      // (évite un rechargement qui efface le message d'erreur)
      if (window.location.pathname !== '/login') {
        localStorage.removeItem('sitecaisse-auth')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

export default api