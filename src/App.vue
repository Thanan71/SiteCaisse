<template>
  <div id="app">
    <SpeedInsights />
    <Navbar v-if="authStore.isAuthenticated" />
    <main :class="{ 'with-navbar': authStore.isAuthenticated }">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { SpeedInsights } from '@vercel/speed-insights/vue'
import { onMounted } from 'vue'
import Navbar from './components/Navbar.vue'
import { useAuthStore } from './store/auth'

const authStore = useAuthStore()

onMounted(() => {
  // Si un token existe au chargement, vérifier qu'il est toujours valide
  if (authStore.token) {
    authStore.fetchUser().catch(() => {
      // Token invalide - logout déjà fait dans le catch
    })
  }
})
</script>

<style scoped>
#app {
  min-height: 100vh;
  background: #f8fafc;
}

main {
  min-height: 100vh;
}

main.with-navbar {
  padding-top: 64px;
}
</style>
