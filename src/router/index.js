/**
 * @module router/index
 * @description Configuration du routeur Vue Router.
 * Définit les routes de l'application avec un guard de navigation
 * pour protéger l'accès aux pages nécessitant une authentification.
 */
import { createRouter, createWebHistory } from 'vue-router'
import AdminView from '../views/AdminView.vue'
import LoginView from '../views/LoginView.vue'
import RapportsView from '../views/RapportsView.vue'
import VentesView from '../views/VentesView.vue'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: LoginView,
    /** @property {boolean} meta.requiresAuth - false = page publique. */
    meta: { requiresAuth: false },
  },
  {
    path: '/',
    name: 'Ventes',
    component: VentesView,
    /** @property {boolean} meta.requiresAuth - true = page protégée. */
    meta: { requiresAuth: true },
  },
  {
    path: '/rapports',
    name: 'Rapports',
    component: RapportsView,
    /** @property {boolean} meta.requiresAuth - true = page protégée. */
    meta: { requiresAuth: true },
  },
  {
    path: '/admin',
    name: 'Admin',
    component: AdminView,
    /** @property {boolean} meta.requiresAuth - true = page protégée. */
    /** @property {boolean} meta.requiresAdmin - true = page réservée aux admins. */
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

/**
 * Vérifie si une session Supabase est active dans le localStorage.
 * @returns {boolean} true si un token d'accès Supabase est présent.
 */
function hasSupabaseSession() {
  try {
    const authStorage = localStorage.getItem('sitecaisse-auth')
    if (!authStorage) return false
    const parsed = JSON.parse(authStorage)
    return !!parsed?.access_token
  } catch {
    return false
  }
}

/**
 * Vérifie le rôle admin depuis la session Supabase stockée.
 * Les métadonnées utilisateur (user_metadata) sont incluses dans la session.
 * @returns {string|null} Le rôle de l'utilisateur ou null si non connecté.
 */
function getUserRoleFromSession() {
  try {
    const authStorage = localStorage.getItem('sitecaisse-auth')
    if (!authStorage) return null
    const parsed = JSON.parse(authStorage)
    return parsed?.user?.user_metadata?.role || null
  } catch {
    return null
  }
}

/**
 * Guard de navigation : protège les routes nécessitant une authentification.
 * Redirige vers la page de connexion si l'utilisateur n'a pas de session Supabase.
 * Redirige vers la page des ventes si l'utilisateur déjà connecté tente d'accéder à /login.
 * @param {import('vue-router').RouteRecordNormalized} to - Route de destination.
 * @param {import('vue-router').RouteRecordNormalized} from - Route d'origine.
 * @param {import('vue-router').NavigationGuardNext} next - Fonction pour résoudre la navigation.
 * @returns {void}
 */
router.beforeEach((to, _from, next) => {
  const hasSession = hasSupabaseSession()

  if (to.meta.requiresAuth && !hasSession) {
    next({ name: 'Login' })
  } else if (to.name === 'Login' && hasSession) {
    next({ name: 'Ventes' })
  } else if (to.meta.requiresAdmin) {
    const role = getUserRoleFromSession()
    if (role !== 'admin') {
      next({ name: 'Ventes' })
    } else {
      next()
    }
  } else {
    next()
  }
})

export default router
