import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import VentesView from '../views/VentesView.vue'
import RapportsView from '../views/RapportsView.vue'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: LoginView,
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    name: 'Ventes',
    component: VentesView,
    meta: { requiresAuth: true }
  },
  {
    path: '/rapports',
    name: 'Rapports',
    component: RapportsView,
    meta: { requiresAuth: true }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation guard : protéger les routes qui nécessitent une auth
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')

  if (to.meta.requiresAuth && !token) {
    next({ name: 'Login' })
  } else if (to.name === 'Login' && token) {
    next({ name: 'Ventes' })
  } else {
    next()
  }
})

export default router