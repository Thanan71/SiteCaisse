<template>
  <div class="suggestions-page submission-page">
    <header class="suggestions-header">
      <h1>Proposer une amélioration</h1>
      <p>Une idée ou une difficulté à partager ? Envoyez une suggestion pour améliorer Site Caisse.</p>
    </header>

    <form class="suggestions-panel suggestion-form" :aria-busy="submitting" @submit.prevent="submitSuggestion">
      <p class="muted">Tous les champs sont obligatoires.</p>
      <div class="form-field">
        <label for="suggestion-title">Titre</label>
        <input id="suggestion-title" v-model="titre" type="text" maxlength="120" required :disabled="submitting" aria-describedby="suggestion-title-count" />
        <span id="suggestion-title-count" class="character-count">{{ titre.length }} / 120 caractères</span>
      </div>
      <div class="form-field">
        <label for="suggestion-description">Description</label>
        <textarea id="suggestion-description" v-model="description" rows="7" maxlength="2000" required :disabled="submitting" aria-describedby="suggestion-description-hint suggestion-description-count"></textarea>
        <span id="suggestion-description-hint" class="muted">Décrivez votre besoin et, si possible, un exemple concret.</span>
        <span id="suggestion-description-count" class="character-count">{{ description.length }} / 2000 caractères</span>
      </div>
      <p v-if="error" class="error-message" role="alert">{{ error }}</p>
      <p class="success-message" role="status" aria-live="polite">{{ success }}</p>
      <button class="btn btn-primary" type="submit" :disabled="submitting">
        {{ submitting ? 'Envoi en cours...' : 'Envoyer la suggestion' }}
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import api from '../services/api'

const titre = ref('')
const description = ref('')
const submitting = ref(false)
const error = ref('')
const success = ref('')

async function submitSuggestion() {
  if (submitting.value) return
  error.value = ''
  success.value = ''
  const payload = { titre: titre.value.trim(), description: description.value.trim() }
  if (!payload.titre || !payload.description) {
    error.value = 'Renseignez un titre et une description.'
    return
  }
  if (titre.value.length > 120 || description.value.length > 2000) {
    error.value = 'Le titre est limité à 120 caractères et la description à 2000 caractères.'
    return
  }

  submitting.value = true
  try {
    await api.post('/api/suggestions', payload)
    titre.value = ''
    description.value = ''
    success.value = 'Votre suggestion a bien été envoyée. Merci pour votre contribution !'
  } catch (err) {
    error.value = err.response?.data?.error || "Impossible d'envoyer votre suggestion. Réessayez."
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped src="../assets/suggestions.css"></style>
