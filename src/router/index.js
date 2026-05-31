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
 * Guard de navigation : protège les routes nécessitant une authentification.
 * Redirige vers la page de connexion si l'utilisateur n'a pas de token.
 * Redirige vers la page des ventes si l'utilisateur déjà connecté tente d'accéder à /login.
 * @param {import('vue-router').RouteRecordNormalized} to - Route de destination.
 * @param {import('vue-router').RouteRecordNormalized} from - Route d'origine.
 * @param {import('vue-router').NavigationGuardNext} next - Fonction pour résoudre la navigation.
 * @returns {void}
 */
router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('token')

  if (to.meta.requiresAuth && !token) {
    next({ name: 'Login' })
  } else if (to.name === 'Login' && token) {
    next({ name: 'Ventes' })
  } else if (to.meta.requiresAdmin) {
    // Vérifier le rôle admin depuis le localStorage
    try {
      const user = JSON.parse(localStorage.getItem('user') || 'null')
      if (user?.role !== 'admin') {
        next({ name: 'Ventes' })
      } else {
        next()
      }
    } catch {
      next({ name: 'Ventes' })
    }
  } else {
    next()
  }
})

export default router
