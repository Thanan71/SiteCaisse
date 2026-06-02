<template>
  <div class="change-password-page">
    <div class="change-password-card">
      <div class="change-password-header">
        <div class="change-password-icon">🔒</div>
        <h1>Changement de mot de passe obligatoire</h1>
        <p class="change-password-subtitle">
          Vous devez changer votre mot de passe avant de pouvoir accéder à l'application.
        </p>
      </div>

      <form @submit.prevent="handleChangePassword" class="change-password-form">
        <div class="form-group">
          <label for="new-password">Nouveau mot de passe</label>
          <input
            id="new-password"
            v-model="newPassword"
            type="password"
            placeholder="Nouveau mot de passe"
            required
            minlength="4"
            autocomplete="new-password"
          />
        </div>

        <div class="form-group">
          <label for="confirm-password">Confirmer le nouveau mot de passe</label>
          <input
            id="confirm-password"
            v-model="confirmPassword"
            type="password"
            placeholder="Confirmer le mot de passe"
            required
            minlength="4"
            autocomplete="new-password"
          />
        </div>

        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <div v-if="success" class="success-message">
          {{ success }}
        </div>

        <button type="submit" class="btn-submit" :disabled="loading">
          {{ loading ? 'Changement en cours...' : 'Changer le mot de passe' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../store/auth'

const router = useRouter()
const authStore = useAuthStore()

const newPassword = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')

async function handleChangePassword() {
  error.value = ''
  success.value = ''

  if (newPassword.value !== confirmPassword.value) {
    error.value = 'Les nouveaux mots de passe ne correspondent pas'
    return
  }

  if (newPassword.value.length < 4) {
    error.value = 'Le nouveau mot de passe doit contenir au moins 4 caractères'
    return
  }

  loading.value = true

  try {
    await authStore.changePassword(newPassword.value)
    success.value = 'Mot de passe modifié avec succès !'
    setTimeout(() => {
      router.push('/')
    }, 1500)
  } catch (err) {
    error.value = err.response?.data?.error || 'Erreur lors du changement de mot de passe'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.change-password-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  padding: 20px;
}

.change-password-card {
  background: white;
  border-radius: 20px;
  padding: 40px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
}

.change-password-header {
  text-align: center;
  margin-bottom: 32px;
}

.change-password-icon {
  font-size: 3rem;
  margin-bottom: 8px;
}

.change-password-header h1 {
  margin: 0;
  font-size: 1.4rem;
  color: #1e293b;
  font-weight: 700;
}

.change-password-subtitle {
  color: #64748b;
  margin: 8px 0 0;
  font-size: 0.85rem;
  line-height: 1.5;
}

.change-password-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-weight: 600;
  font-size: 0.85rem;
  color: #374151;
}

.form-group input {
  padding: 12px 14px;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  font-size: 0.95rem;
  transition: all 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

.form-group input::placeholder {
  color: #9ca3af;
}

.error-message {
  background: #fef2f2;
  color: #dc2626;
  padding: 12px 14px;
  border-radius: 10px;
  font-size: 0.85rem;
  text-align: center;
}

.success-message {
  background: #f0fdf4;
  color: #16a34a;
  padding: 12px 14px;
  border-radius: 10px;
  font-size: 0.85rem;
  text-align: center;
}

.btn-submit {
  padding: 12px;
  background: #4f46e5;
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 8px;
}

.btn-submit:hover:not(:disabled) {
  background: #4338ca;
  transform: translateY(-1px);
}

.btn-submit:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>