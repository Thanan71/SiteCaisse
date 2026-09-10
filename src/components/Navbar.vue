<template>
  <nav class="navbar">
    <div class="navbar-brand">
      <router-link to="/" class="navbar-logo" @click="closeMobileMenu">
        <span class="logo-icon">📊</span>
        <span class="logo-text">Site Caisse</span>
      </router-link>
    </div>

    <div v-if="authStore.isAuthenticated" class="navbar-menu">
      <router-link to="/" class="navbar-link" :class="{ active: $route.path === '/' }">
        Ventes
      </router-link>
      <router-link
        to="/rapports"
        class="navbar-link"
        :class="{ active: $route.path === '/rapports' }"
      >
        Rapports
      </router-link>
      <router-link
        v-if="authStore.isAdmin"
        to="/admin"
        class="navbar-link"
        :class="{ active: $route.path === '/admin' }"
      >
        Admin
      </router-link>
    </div>

    <div v-if="authStore.isAuthenticated" class="navbar-user">
      <span class="user-info">
        <span class="user-name">{{ authStore.userName }}</span>
        <span
          class="user-role"
          :class="
            authStore.isAdmin
              ? 'badge-admin'
              : authStore.isPermanent
                ? 'badge-permanent'
                : 'badge-temporaire'
          "
        >
          {{ authStore.isAdmin ? 'Admin' : authStore.isPermanent ? 'Permanent' : 'Temporaire' }}
        </span>
      </span>
      <button type="button" class="btn-logout" @click="handleLogout">Déconnexion</button>
    </div>

    <button
      v-if="authStore.isAuthenticated"
      type="button"
      class="navbar-toggle"
      :class="{ 'is-open': mobileMenuOpen }"
      :aria-expanded="mobileMenuOpen"
      aria-controls="mobile-navigation"
      :aria-label="mobileMenuOpen ? 'Fermer le menu de navigation' : 'Ouvrir le menu de navigation'"
      @click="toggleMobileMenu"
    >
      <span class="burger-line"></span>
      <span class="burger-line"></span>
      <span class="burger-line"></span>
    </button>

    <div
      v-if="authStore.isAuthenticated && mobileMenuOpen"
      id="mobile-navigation"
      class="navbar-mobile-menu"
    >
      <div class="mobile-links">
        <router-link
          to="/"
          class="navbar-mobile-link"
          :class="{ active: $route.path === '/' }"
          @click="closeMobileMenu"
        >
          Ventes
        </router-link>
        <router-link
          to="/rapports"
          class="navbar-mobile-link"
          :class="{ active: $route.path === '/rapports' }"
          @click="closeMobileMenu"
        >
          Rapports
        </router-link>
        <router-link
          v-if="authStore.isAdmin"
          to="/admin"
          class="navbar-mobile-link"
          :class="{ active: $route.path === '/admin' }"
          @click="closeMobileMenu"
        >
          Admin
        </router-link>
      </div>

      <div class="mobile-user-section">
        <div class="mobile-user-info">
          <span class="user-name">{{ authStore.userName }}</span>
          <span
            class="user-role"
            :class="
              authStore.isAdmin
                ? 'badge-admin'
                : authStore.isPermanent
                  ? 'badge-permanent'
                  : 'badge-temporaire'
            "
          >
            {{ authStore.isAdmin ? 'Admin' : authStore.isPermanent ? 'Permanent' : 'Temporaire' }}
          </span>
        </div>
        <button type="button" class="btn-logout mobile-logout" @click="handleLogout">
          Déconnexion
        </button>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../store/auth'

const router = useRouter()
const authStore = useAuthStore()
const mobileMenuOpen = ref(false)

function toggleMobileMenu() {
  mobileMenuOpen.value = !mobileMenuOpen.value
}

function closeMobileMenu() {
  mobileMenuOpen.value = false
}

function handleLogout() {
  closeMobileMenu()
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
  flex-shrink: 0;
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
  flex-shrink: 0;
}

.user-info,
.mobile-user-info {
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

.badge-admin {
  background: #f3e8ff;
  color: #9333ea;
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

.navbar-toggle {
  display: none;
  width: 44px;
  height: 44px;
  margin-left: auto;
  padding: 10px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: white;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 5px;
}

.burger-line {
  display: block;
  width: 22px;
  height: 2px;
  border-radius: 999px;
  background: #475569;
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.navbar-toggle.is-open .burger-line:nth-child(1) {
  transform: translateY(7px) rotate(45deg);
}

.navbar-toggle.is-open .burger-line:nth-child(2) {
  opacity: 0;
}

.navbar-toggle.is-open .burger-line:nth-child(3) {
  transform: translateY(-7px) rotate(-45deg);
}

.navbar-mobile-menu {
  display: none;
}

@media (max-width: 900px) {
  .navbar {
    padding: 0 16px;
  }

  .navbar-menu,
  .navbar-user {
    display: none;
  }

  .navbar-toggle {
    display: flex;
  }

  .navbar-mobile-menu {
    position: absolute;
    top: 64px;
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    max-height: calc(100dvh - 64px);
    overflow-y: auto;
    background: white;
    border-bottom: 1px solid #e2e8f0;
    box-shadow: 0 12px 24px rgba(15, 23, 42, 0.12);
  }

  .mobile-links {
    display: flex;
    flex-direction: column;
    padding: 12px 16px;
    gap: 4px;
  }

  .navbar-mobile-link {
    display: flex;
    align-items: center;
    min-height: 44px;
    padding: 10px 14px;
    border-radius: 8px;
    color: #475569;
    font-weight: 600;
    font-size: 0.95rem;
    text-decoration: none;
  }

  .navbar-mobile-link:hover {
    background: #f1f5f9;
    color: #4f46e5;
  }

  .navbar-mobile-link.active {
    background: #eef2ff;
    color: #4f46e5;
  }

  .mobile-user-section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 16px;
    border-top: 1px solid #e2e8f0;
    background: #f8fafc;
  }

  .mobile-logout {
    min-height: 44px;
    flex-shrink: 0;
  }
}

@media (max-width: 480px) {
  .logo-text {
    font-size: 1rem;
  }

  .mobile-user-section {
    align-items: stretch;
    flex-direction: column;
  }

  .mobile-user-info {
    justify-content: space-between;
  }

  .mobile-logout {
    width: 100%;
  }
}
</style>
