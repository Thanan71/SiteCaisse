/**
 * @module services/api
 * @description Service de configuration Axios.
 * Centralise la configuration du client HTTP et les intercepteurs
 * pour l'authentification JWT et la gestion des erreurs 401.
 */
import axios from 'axios'

// Configuration de base
axios.defaults.baseURL = import.meta.env.VITE_API_URL || ''

/**
 * Intercepteur de requête : ajoute automatiquement le token JWT
 * à chaque requête sortante.
 * @param {import('axios').InternalAxiosRequestConfig} config - Configuration de la requête.
 * @returns {import('axios').InternalAxiosRequestConfig} Configuration modifiée avec le token.
 */
axios.interceptors.request.use(config => {
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
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default axios