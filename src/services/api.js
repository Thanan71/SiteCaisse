/**
 * @module services/api
 * @description Service de configuration Axios.
 * Centralise la configuration du client HTTP et les intercepteurs
 * pour l'authentification JWT et la gestion des erreurs 401.
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
  baseURL: import.meta.env.VITE_API_URL || ''
})

/**
 * Intercepteur de requête : ajoute automatiquement le token JWT
 * à chaque requête sortante.
 * @param {import('axios').InternalAxiosRequestConfig} config - Configuration de la requête.
 * @returns {import('axios').InternalAxiosRequestConfig} Configuration modifiée avec le token.
 */
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
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
  response => response,
  error => {
    if (error.response && error.response.status === 401) {
      // Ne pas rediriger si on est déjà sur la page de login
      // (évite un rechargement qui efface le message d'erreur)
      if (window.location.pathname !== '/login') {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
