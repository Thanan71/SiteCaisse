<template>
  <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card modal-card-wide">
      <div class="modal-header">
        <h2>{{ title }}</h2>
        <button class="btn-close" type="button" aria-label="Fermer" @click="$emit('close')">
          &times;
        </button>
      </div>

      <form @submit.prevent="handleSubmit" class="modal-form">
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group">
              <label :for="fieldId('date')">Date</label>
              <input :id="fieldId('date')" v-model="form.date_vente" type="date" required />
            </div>

            <!-- Artisan global retiré: on sélectionne un artisan par article maintenant -->
          </div>

          <div class="form-group">
            <label :for="fieldId('paiement')">Type de paiement</label>
            <select :id="fieldId('paiement')" v-model="form.type_paiement" required>
              <option v-if="mode === 'create'" value="" disabled>Choisir</option>
              <option value="CB">Carte Bancaire</option>
              <option value="Espece">Espèce</option>
              <option value="Cheque">Chèque</option>
            </select>
          </div>

          <div class="section-title">
            <div>
              <h3>Articles</h3>
              <span class="section-subtitle">
                {{ form.articles.length }} ligne{{ form.articles.length > 1 ? 's' : '' }}
              </span>
            </div>
            <button type="button" class="btn btn-sm btn-secondary" @click="addArticle">
              + Ajouter un article
            </button>
          </div>

          <div class="articles-list">
            <div
              v-for="(article, index) in form.articles"
              :key="index"
              class="article-row"
              :class="{ 'article-highlight': shouldHighlightArticle(index) }"
            >
              <div class="article-header" v-if="form.articles.length > 1">
                <span class="article-number">Article n°{{ index + 1 }}</span>
                <button
                  type="button"
                  class="btn-icon-remove"
                  @click="removeArticle(index)"
                  :aria-label="`Supprimer l'article n°${index + 1}`"
                  :title="`Supprimer l'article n°${index + 1}`"
                >
                  &times;
                </button>
              </div>
              <div class="form-row article-fields">
                <div class="form-group form-group-article">
                  <label :for="fieldId(`article-name-${index}`)">Nom de l'article</label>
                  <input
                    :id="fieldId(`article-name-${index}`)"
                    v-model="article.article"
                    type="text"
                    :placeholder="mode === 'create' ? 'Ex: Pot en céramique' : ''"
                    required
                  />
                </div>
                <div class="form-group form-group-qty">
                  <label :for="fieldId(`article-qty-${index}`)">Qté</label>
                  <input
                    :id="fieldId(`article-qty-${index}`)"
                    v-model.number="article.quantite"
                    type="number"
                    min="1"
                    required
                  />
                </div>
                <div class="form-group form-group-artisan">
                  <label :for="fieldId(`article-artisan-${index}`)">Artisan</label>
                  <select
                    :id="fieldId(`article-artisan-${index}`)"
                    v-model="article.artisan_id"
                    required
                  >
                    <option value="" disabled>Sélectionner un artisan</option>
                    <option v-for="artisan in artisans" :key="artisan.id" :value="artisan.id">
                      {{ getArtisanOptionLabel(artisan) }}
                    </option>
                  </select>
                </div>
                <div class="form-group form-group-price">
                  <label :for="fieldId(`article-price-${index}`)">Prix (€)</label>
                  <input
                    :id="fieldId(`article-price-${index}`)"
                    v-model.number="article.prix"
                    type="number"
                    step="0.01"
                    min="0"
                    :placeholder="mode === 'create' ? '0.00' : ''"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          <div v-if="error" class="form-error">{{ error }}</div>
        </div>

        <div class="modal-actions">
          <div class="sale-summary" aria-live="polite">
            <span>{{ articleCountLabel }}</span>
            <strong>Total : {{ formattedTotal }}</strong>
          </div>
          <div class="modal-action-buttons">
            <button type="button" class="btn btn-secondary" @click="$emit('close')">Annuler</button>
            <button type="submit" class="btn btn-primary" :disabled="loading">
              {{ loading ? loadingLabel : submitLabel }}
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useArtisansStore } from '../store/artisans'
import { useVentesStore } from '../store/ventes'

const props = defineProps({
  show: Boolean,
  mode: {
    type: String,
    default: 'create',
    validator: (value) => ['create', 'edit'].includes(value),
  },
  vente: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['close', 'saved'])

const ventesStore = useVentesStore()
const artisansStore = useArtisansStore()
const loading = ref(false)
const error = ref(null)

const title = computed(() => (props.mode === 'edit' ? 'Modifier la vente' : 'Ajouter une vente'))
const submitLabel = computed(() => (props.mode === 'edit' ? 'Enregistrer' : 'Ajouter la vente'))
const loadingLabel = computed(() =>
  props.mode === 'edit' ? 'Modification...' : 'Ajout en cours...',
)

const emptyArticle = () => ({
  article: '',
  quantite: 1,
  prix: '',
  artisan_id: '',
})

function getTodayParisDate() {
  const now = new Date()
  return now.toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' }) // fr-CA donne format YYYY-MM-DD
}

const defaultForm = () => ({
  date_vente: getTodayParisDate(),
  type_paiement: '',
  articles: [{ ...emptyArticle() }],
})

const form = reactive(defaultForm())

const selectedArtisanIds = computed(
  () => new Set(form.articles.map((article) => String(article.artisan_id)).filter(Boolean)),
)

const artisans = computed(() => {
  const allArtisans = artisansStore.artisans || []
  return allArtisans.filter(
    (artisan) => isActiveArtisan(artisan) || selectedArtisanIds.value.has(String(artisan.id)),
  )
})

const totalQuantity = computed(() =>
  form.articles.reduce((total, article) => total + Math.max(0, Number(article.quantite) || 0), 0),
)

const totalAmount = computed(() =>
  form.articles.reduce((total, article) => {
    const quantity = Math.max(0, Number(article.quantite) || 0)
    const price = Math.max(0, Number(article.prix) || 0)
    return total + quantity * price
  }, 0),
)

const articleCountLabel = computed(
  () =>
    `${totalQuantity.value} article${totalQuantity.value > 1 ? 's' : ''} • ${form.articles.length} ligne${form.articles.length > 1 ? 's' : ''}`,
)

const formattedTotal = computed(() =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(totalAmount.value),
)

watch(
  () => props.show,
  async (isOpen) => {
    if (!isOpen) {
      resetForm()
      return
    }

    hydrateForm()
    await fetchArtisansIfNeeded()
  },
)

watch(
  () => props.vente,
  () => {
    if (props.show) hydrateForm()
  },
  { immediate: true },
)

function fieldId(name) {
  return `${props.mode}-vente-${name}`
}

function getArtisanBoutiqueLabel(artisan) {
  return artisan.nom_boutique || artisan.nom || 'Boutique inconnue'
}

function getArtisanRoleLabel(artisan) {
  return artisan.role === 'permanent' ? 'Permanent' : 'Temporaire'
}

function isActiveArtisan(artisan) {
  return artisan.est_actif !== false
}

function getArtisanOptionLabel(artisan) {
  const status = isActiveArtisan(artisan) ? '' : ', archivé'
  return `${getArtisanBoutiqueLabel(artisan)} (${getArtisanRoleLabel(artisan)}${status})`
}

function hydrateForm() {
  if (props.mode === 'edit' && props.vente) {
    form.date_vente = props.vente.date_vente || ''
    form.type_paiement = props.vente.type_paiement || ''
    form.articles = props.vente.articles?.length
      ? props.vente.articles.map((article) => ({
          article: article.article || '',
          quantite: article.quantite || 1,
          prix: article.prix || '',
          artisan_id: article.artisan_id || '',
        }))
      : [{ ...emptyArticle() }]
    return
  }

  resetForm()
}

function resetForm() {
  Object.assign(form, defaultForm())
  error.value = null
}

async function fetchArtisansIfNeeded() {
  try {
    await artisansStore.fetchArtisans({ includeInactive: true })
  } catch (err) {
    error.value = 'Erreur lors du chargement des artisans'
  }
}

async function addArticle() {
  const index = form.articles.length
  form.articles.push({ ...emptyArticle() })
  await nextTick()

  const input = document.getElementById(fieldId(`article-name-${index}`))
  input?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  input?.focus()
}

function removeArticle(index) {
  if (form.articles.length > 1) {
    form.articles.splice(index, 1)
  }
}

function shouldHighlightArticle(index) {
  return props.mode === 'create' && index === form.articles.length - 1 && form.articles.length > 1
}

function buildPayload() {
  return {
    articles: form.articles.map((article) => ({
      article: article.article,
      quantite: article.quantite || 1,
      prix: parseFloat(article.prix),
      artisan_id: article.artisan_id || null,
    })),
    type_paiement: form.type_paiement,
    date_vente: form.date_vente,
  }
}

async function handleSubmit() {
  loading.value = true
  error.value = null

  try {
    if (props.mode === 'edit') {
      await ventesStore.updateVente(props.vente.id, buildPayload())
      emit('saved')
    } else {
      await ventesStore.addVente(buildPayload())
      emit('saved')
      emit('close')
    }
  } catch (err) {
    error.value =
      err.response?.data?.error ||
      (props.mode === 'edit'
        ? 'Erreur lors de la modification'
        : "Erreur lors de l'ajout de la vente")
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.modal-card-wide {
  max-width: 760px;
  max-height: calc(100dvh - 40px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
  color: #1e293b;
}

.btn-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: none;
  border: none;
  border-radius: 8px;
  font-size: 1.5rem;
  color: #94a3b8;
  cursor: pointer;
  line-height: 1;
}

.btn-close:hover {
  color: #64748b;
  background: #f8fafc;
}

.modal-form {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
}

.modal-body {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 20px 24px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-error {
  background: #fef2f2;
  color: #ef4444;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 0.85rem;
  margin-top: 16px;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 20px 0 12px;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
}

.section-title h3 {
  margin: 0;
  font-size: 1rem;
  color: #1e293b;
}

.section-subtitle {
  display: block;
  margin-top: 2px;
  color: #64748b;
  font-size: 0.78rem;
}

.articles-list {
  scroll-margin-bottom: 24px;
}

.article-row {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px 16px;
  margin-bottom: 12px;
  transition: border-color 0.2s;
}

.article-highlight {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.article-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.article-number {
  font-weight: 600;
  font-size: 0.8rem;
  color: #64748b;
}

.btn-icon-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: none;
  border: none;
  border-radius: 8px;
  font-size: 1.4rem;
  color: #ef4444;
  cursor: pointer;
  line-height: 1;
  opacity: 0.75;
  transition:
    opacity 0.2s,
    background 0.2s;
}

.btn-icon-remove:hover {
  opacity: 1;
  background: #fef2f2;
}

.article-fields {
  grid-template-columns: 1fr 80px 160px 110px;
}

.form-group-article,
.form-group-qty,
.form-group-artisan,
.form-group-price {
  margin-bottom: 0;
}

.btn-sm {
  font-size: 0.8rem;
  padding: 8px 12px;
}

.modal-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 24px;
  border-top: 1px solid #e2e8f0;
  background: white;
  box-shadow: 0 -8px 20px rgba(15, 23, 42, 0.04);
  flex-shrink: 0;
}

.sale-summary {
  display: flex;
  min-width: 0;
  flex-direction: column;
  color: #64748b;
  font-size: 0.8rem;
}

.sale-summary strong {
  color: #1e293b;
  font-size: 1rem;
}

.modal-action-buttons {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}

@media (max-width: 700px) {
  .modal-overlay {
    align-items: stretch;
    padding: 0;
  }

  .modal-card-wide {
    width: 100%;
    max-width: none;
    height: 100dvh;
    max-height: 100dvh;
    border-radius: 0;
  }

  .modal-header,
  .modal-body,
  .modal-actions {
    padding-left: 16px;
    padding-right: 16px;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .article-fields {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .form-group-article,
  .form-group-artisan {
    grid-column: 1 / -1;
  }

  .section-title {
    align-items: flex-end;
  }

  .modal-actions {
    align-items: stretch;
    flex-direction: column;
    gap: 10px;
  }

  .sale-summary {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .modal-action-buttons {
    width: 100%;
  }

  .modal-action-buttons .btn {
    flex: 1;
    justify-content: center;
  }
}

@media (max-width: 420px) {
  .section-title {
    align-items: stretch;
    flex-direction: column;
  }

  .section-title .btn {
    justify-content: center;
    width: 100%;
  }
}
</style>
