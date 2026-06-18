<template>
  <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card modal-card-wide">
      <div class="modal-header">
        <h2>{{ title }}</h2>
        <button class="btn-close" @click="$emit('close')">&times;</button>
      </div>

      <form @submit.prevent="handleSubmit" class="modal-body">
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
          <h3>Articles</h3>
          <button type="button" class="btn btn-sm btn-secondary" @click="addArticle">
            + Ajouter un article
          </button>
        </div>

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
              title="Supprimer cet article"
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
                  {{ getArtisanBoutiqueLabel(artisan) }} ({{ artisan.role === 'permanent' ? 'Permanent' : 'Temporaire' }})
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

        <div v-if="error" class="form-error">{{ error }}</div>

        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" @click="$emit('close')">Annuler</button>
          <button type="submit" class="btn btn-primary" :disabled="loading">
            {{ loading ? loadingLabel : submitLabel }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
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
const artisans = computed(() => artisansStore.artisans)
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
  if (artisansStore.artisans.length > 0) return

  try {
    await artisansStore.fetchArtisans()
  } catch (err) {
    error.value = 'Erreur lors du chargement des artisans'
  }
}

function addArticle() {
  form.articles.push({ ...emptyArticle() })
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
  max-width: 680px;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 0;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
  color: #1e293b;
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
}

.btn-close:hover {
  color: #64748b;
}

.modal-body {
  padding: 20px 24px 24px;
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
  margin-bottom: 16px;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 20px 0 12px;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
}

.section-title h3 {
  margin: 0;
  font-size: 1rem;
  color: #1e293b;
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
  background: none;
  border: none;
  font-size: 1.4rem;
  color: #ef4444;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.btn-icon-remove:hover {
  opacity: 1;
}

.article-fields {
  grid-template-columns: 1fr 80px 160px 110px;
}

.form-group-article,
.form-group-qty,
.form-group-price {
  margin-bottom: 0;
}

.btn-sm {
  font-size: 0.8rem;
  padding: 6px 12px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}
</style>
