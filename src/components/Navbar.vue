<template>
  <nav class="navbar">
    <div class="navbar-brand">
      <router-link to="/" class="navbar-logo">
        <span class="logo-icon">📊</span>
        <span class="logo-text">Site Caisse</span>
      </router-link>
    </div>

    <div class="navbar-menu" v-if="authStore.isAuthenticated">
      <router-link to="/" class="navbar-link" :class="{ active: $route.path === '/' }">
        Ventes
      </router-link>
      <router-link to="/rapports" class="navbar-link" :class="{ active: $route.path === '/rapports' }">
        Rapports
      </router-link>
    </div>

    <div class="navbar-user" v-if="authStore.isAuthenticated">
      <span class="user-info">
        <span class="user-name">{{ authStore.userName }}</span>
        <span class="user-role" :class="authStore.isPermanent ? 'badge-permanent' : 'badge-temporaire'">
          {{ authStore.isPermanent ? 'Permanent' : 'Temporaire' }}
        </span>
      </span>
      <button @click="handleLogout" class="btn-logout">
        Déconnexion
      </button>
    </div>
  </nav>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '../store/auth'

const router = useRouter()
const authStore = useAuthStore()

function handleLogout() {
  authStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 64px;
  background: white;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  padding: 0 24px;
  z-index: 1000;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.navbar-brand {
  display: flex;
  align-items: center;
}

.navbar-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  color: #1e293b;
  font-weight: 700;
  font-size: 1.2rem;
}

.logo-icon {
  font-size: 1.5rem;
}

.navbar-menu {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 40px;
  flex: 1;
}

.navbar-link {
  padding: 8px 16px;
  border-radius: 8px;
  text-decoration: none;
  color: #64748b;
  font-weight: 500;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.navbar-link:hover {
  background: #f1f5f9;
  color: #4f46e5;
}

.navbar-link.active {
  background: #eef2ff;
  color: #4f46e5;
}

.navbar-user {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-name {
  font-weight: 600;
  color: #1e293b;
  font-size: 0.9rem;
}

.user-role {
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 500;
}

.badge-permanent {
  background: #dbeafe;
  color: #2563eb;
}

.badge-temporaire {
  background: #fef3c7;
  color: #d97706;
}

.btn-logout {
  padding: 6px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  color: #64748b;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-logout:hover {
  background: #fef2f2;
  border-color: #fca5a5;
  color: #ef4444;
}
</style>