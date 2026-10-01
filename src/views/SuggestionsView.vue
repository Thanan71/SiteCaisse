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

    <section class="personal-suggestions" aria-labelledby="personal-suggestions-title">
      <header class="personal-suggestions-header">
        <h2 id="personal-suggestions-title">Mes suggestions</h2>
        <p class="muted">Retrouvez vos propositions et suivez leur état. Les dates sont affichées en heure de Paris.</p>
      </header>
      <div class="suggestions-list-header">
        <p role="status" aria-live="polite">{{ loadingSuggestions ? 'Chargement de vos suggestions...' : `${total} suggestion${total > 1 ? 's' : ''}` }}</p>
        <button type="button" class="btn btn-secondary" :disabled="loadingSuggestions" @click="fetchSuggestions(page)">Actualiser</button>
      </div>
      <p v-if="suggestionsError" class="error-message" role="alert">{{ suggestionsError }}</p>
      <p v-if="!loadingSuggestions && !suggestionsError && suggestions.length === 0" class="suggestions-panel empty-state">Vous n’avez pas encore envoyé de suggestion.</p>
      <div class="suggestions-list" :aria-busy="loadingSuggestions">
        <details v-for="suggestion in suggestions" :key="suggestion.id" class="suggestion-item" :data-suggestion-id="suggestion.id">
          <summary class="suggestion-summary">
            <span class="suggestion-title">{{ suggestion.titre }}</span>
            <span class="personal-suggestion-metadata">
              <time class="muted" :datetime="suggestion.created_at">{{ formatSuggestionDate(suggestion.created_at) }}</time>
              <span class="suggestion-status" :class="`status-${suggestion.statut}`">{{ suggestionStatusLabel(suggestion.statut) }}</span>
            </span>
          </summary>
          <div class="suggestion-detail">
            <p class="suggestion-description">{{ suggestion.description }}</p>
          </div>
        </details>
      </div>
      <nav v-if="total > 0" class="suggestions-pagination" aria-label="Pagination de mes suggestions">
        <button type="button" class="btn btn-secondary" :disabled="loadingSuggestions || page <= 1" @click="fetchSuggestions(page - 1)">Précédent</button>
        <span>Page {{ page }} / {{ totalPages }}</span>
        <button type="button" class="btn btn-secondary" :disabled="loadingSuggestions || page >= totalPages" @click="fetchSuggestions(page + 1)">Suivant</button>
      </nav>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import api from '../services/api'
import { formatSuggestionDate, suggestionStatusLabel } from '../utils/suggestions'

const titre = ref('')
const description = ref('')
const submitting = ref(false)
const error = ref('')
const success = ref('')
const suggestions = ref([])
const total = ref(0)
const page = ref(1)
const limit = ref(20)
const loadingSuggestions = ref(false)
const suggestionsError = ref('')
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit.value)))
let requestId = 0

async function fetchSuggestions(nextPage = 1) {
  const currentRequest = ++requestId
  loadingSuggestions.value = true
  suggestionsError.value = ''
  try {
    const { data } = await api.get('/api/suggestions/mes', {
      params: { page: nextPage, limit: limit.value },
    })
    if (currentRequest !== requestId) return
    suggestions.value = data.suggestions
    total.value = data.total
    page.value = data.page
    limit.value = data.limit
  } catch (err) {
    if (currentRequest === requestId) {
      suggestionsError.value =
        err.response?.data?.error || 'Impossible de charger vos suggestions. Réessayez.'
    }
  } finally {
    if (currentRequest === requestId) loadingSuggestions.value = false
  }
}

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
    await fetchSuggestions(1)
  } catch (err) {
    error.value = err.response?.data?.error || "Impossible d'envoyer votre suggestion. Réessayez."
  } finally {
    submitting.value = false
  }
}

onMounted(() => fetchSuggestions())
onBeforeUnmount(() => {
  requestId += 1
})
</script>

<style scoped src="../assets/suggestions.css"></style>
