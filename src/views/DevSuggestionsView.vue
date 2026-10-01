<template>
  <div v-if="authStore.isDev" class="suggestions-page">
    <header class="suggestions-header">
      <h1>Suggestions reçues</h1>
      <p>Consultez les propositions et mettez à jour leur statut.</p>
      <p class="muted">Dates et filtres en heure de Paris.</p>
    </header>

    <form class="suggestions-panel suggestions-filters" @submit.prevent="applyFilters">
      <div class="form-field">
        <label for="suggestion-status-filter">Statut</label>
        <select id="suggestion-status-filter" v-model="filters.statut">
          <option value="">Tous les statuts</option>
          <option v-for="status in statuses" :key="status.value" :value="status.value">{{ status.label }}</option>
        </select>
      </div>
      <div class="form-field">
        <label for="suggestion-date-from">Du</label>
        <input id="suggestion-date-from" v-model="filters.date_debut" type="date" />
      </div>
      <div class="form-field">
        <label for="suggestion-date-to">Au</label>
        <input id="suggestion-date-to" v-model="filters.date_fin" type="date" :min="filters.date_debut || undefined" />
      </div>
      <div class="form-field">
        <label for="suggestion-order">Ordre des dates</label>
        <select id="suggestion-order" v-model="filters.ordre">
          <option value="desc">Plus récentes d'abord</option>
          <option value="asc">Plus anciennes d'abord</option>
        </select>
      </div>
      <div class="filter-actions">
        <button type="submit" class="btn btn-primary" :disabled="busy">Appliquer les filtres</button>
        <button type="button" class="btn btn-secondary" :disabled="busy" @click="resetFilters">Réinitialiser</button>
      </div>
    </form>

    <div class="suggestions-list-header">
      <p role="status" aria-live="polite">{{ loading ? 'Chargement des suggestions...' : `${total} suggestion${total > 1 ? 's' : ''}` }}</p>
      <button type="button" class="btn btn-secondary" :disabled="busy" @click="fetchSuggestions(page)">Actualiser</button>
    </div>
    <p v-if="error" role="alert" class="error-message">{{ error }}</p>
    <p v-if="!loading && !error && suggestions.length === 0" class="suggestions-panel empty-state">Aucune suggestion ne correspond aux filtres.</p>

    <div class="suggestions-list" :aria-busy="loading">
      <details v-for="suggestion in suggestions" :key="suggestion.id" class="suggestion-item" :data-suggestion-id="suggestion.id">
        <summary class="suggestion-summary">
          <span class="suggestion-title">{{ suggestion.titre }}</span>
          <span class="suggestion-author">{{ suggestion.auteur_nom || 'Utilisateur supprimé' }}<span v-if="suggestion.auteur_nom_boutique" class="muted"> · {{ suggestion.auteur_nom_boutique }}</span></span>
          <time class="muted" :datetime="suggestion.created_at">{{ formatSuggestionDate(suggestion.created_at) }}</time>
          <span class="suggestion-status" :class="`status-${suggestion.statut}`">{{ statusLabel(suggestion.statut) }}</span>
        </summary>
        <div class="suggestion-detail">
          <p class="suggestion-description">{{ suggestion.description }}</p>
          <form class="suggestion-status-form" @submit.prevent="saveStatus(suggestion)">
            <div class="form-field">
              <label :for="`suggestion-status-${suggestion.id}`">Nouveau statut</label>
              <select :id="`suggestion-status-${suggestion.id}`" v-model="statusDrafts[suggestion.id]" :disabled="busy">
                <option v-for="status in statuses" :key="status.value" :value="status.value">{{ status.label }}</option>
              </select>
            </div>
            <button type="submit" class="btn btn-primary" :disabled="busy || statusDrafts[suggestion.id] === suggestion.statut">
              {{ savingId === suggestion.id ? 'Enregistrement...' : 'Appliquer' }}
            </button>
          </form>
          <p v-if="statusErrors[suggestion.id]" role="alert" class="error-message">{{ statusErrors[suggestion.id] }}</p>
          <p role="status" aria-live="polite" class="success-message">{{ statusSuccesses[suggestion.id] || '' }}</p>
        </div>
      </details>
    </div>

    <nav v-if="total > 0" class="suggestions-pagination" aria-label="Pagination des suggestions">
      <button type="button" class="btn btn-secondary" :disabled="busy || page <= 1" @click="fetchSuggestions(page - 1)">Précédent</button>
      <span>Page {{ page }} / {{ totalPages }}</span>
      <button type="button" class="btn btn-secondary" :disabled="busy || page >= totalPages" @click="fetchSuggestions(page + 1)">Suivant</button>
    </nav>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import api from '../services/api'
import { useAuthStore } from '../store/auth'

const authStore = useAuthStore()
const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})
const statuses = [
  { value: 'nouvelle', label: 'Nouvelle' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'acceptee', label: 'Acceptée' },
  { value: 'refusee', label: 'Refusée' },
]
const defaultFilters = { statut: '', date_debut: '', date_fin: '', ordre: 'desc' }
const filters = reactive({ ...defaultFilters })
const appliedFilters = ref({ ...defaultFilters })
const suggestions = ref([])
const total = ref(0)
const page = ref(1)
const limit = ref(20)
const loading = ref(false)
const error = ref('')
const savingId = ref(null)
const statusDrafts = reactive({})
const statusErrors = reactive({})
const statusSuccesses = reactive({})
const busy = computed(() => loading.value || savingId.value !== null)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit.value)))
let requestId = 0

function statusLabel(value) {
  return statuses.find((status) => status.value === value)?.label || value
}

function formatSuggestionDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date)
}

async function fetchSuggestions(nextPage = 1) {
  if (!authStore.isDev) return
  const currentRequest = ++requestId
  loading.value = true
  error.value = ''
  const params = Object.fromEntries(
    Object.entries({ ...appliedFilters.value, page: nextPage, limit: limit.value }).filter(
      ([, value]) => value !== '',
    ),
  )
  try {
    const { data } = await api.get('/api/suggestions', { params })
    if (currentRequest !== requestId) return
    suggestions.value = data.suggestions
    total.value = data.total
    page.value = data.page
    limit.value = data.limit
    for (const suggestion of data.suggestions) {
      statusDrafts[suggestion.id] = suggestion.statut
      statusErrors[suggestion.id] = ''
      statusSuccesses[suggestion.id] = ''
    }
  } catch (err) {
    if (currentRequest === requestId) {
      error.value = err.response?.data?.error || 'Impossible de charger les suggestions. Réessayez.'
    }
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}

function applyFilters() {
  if (busy.value) return
  if (filters.date_debut && filters.date_fin && filters.date_debut > filters.date_fin) {
    error.value = 'La date de fin doit être postérieure ou égale à la date de début.'
    return
  }
  appliedFilters.value = { ...filters }
  fetchSuggestions(1)
}

function resetFilters() {
  Object.assign(filters, defaultFilters)
  applyFilters()
}

async function saveStatus(suggestion) {
  if (!authStore.isDev || busy.value || statusDrafts[suggestion.id] === suggestion.statut) return
  savingId.value = suggestion.id
  statusErrors[suggestion.id] = ''
  statusSuccesses[suggestion.id] = ''
  try {
    const { data } = await api.patch(`/api/suggestions/${suggestion.id}/statut`, {
      statut: statusDrafts[suggestion.id],
    })
    Object.assign(suggestion, data.suggestion)
    statusDrafts[suggestion.id] = suggestion.statut
    statusSuccesses[suggestion.id] =
      appliedFilters.value.statut && appliedFilters.value.statut !== suggestion.statut
        ? 'Statut mis à jour. Cette suggestion ne correspond plus au filtre ; actualisez la liste.'
        : 'Statut mis à jour.'
  } catch (err) {
    statusErrors[suggestion.id] =
      err.response?.data?.error || 'Impossible de modifier le statut. Réessayez.'
  } finally {
    savingId.value = null
  }
}

onMounted(() => fetchSuggestions())
onBeforeUnmount(() => {
  requestId += 1
})
</script>

<style scoped src="../assets/suggestions.css"></style>
