<template>
  <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card modal-card-wide">
      <div class="modal-header">
        <h2>Ajouter une vente</h2>
        <button class="btn-close" @click="$emit('close')">&times;</button>
      </div>

      <form @submit.prevent="handleSubmit" class="modal-body">
        <div class="form-row">
          <div class="form-group">
            <label for="date">Date</label>
            <input
              id="date"
              v-model="form.date_vente"
              type="date"
              required
            />
          </div>

          <div class="form-group">
            <label for="artisan">Artisan</label>
            <select id="artisan" v-model="form.artisan_id" required>
              <option value="" disabled>Sélectionner un artisan</option>
              <option
                v-for="artisan in artisans"
                :key="artisan.id"
                :value="artisan.id"
              >
                {{ artisan.nom }} ({{ artisan.role === 'permanent' ? 'Permanent' : 'Temporaire' }})
              </option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label for="paiement">Type de paiement</label>
          <select id="paiement" v-model="form.type_paiement" required>
            <option value="" disabled>Choisir</option>
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
          :class="{ 'article-highlight': index === form.articles.length - 1 && form.articles.length > 1 }"
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
              <label :for="'article-name-' + index">Nom de l'article</label>
              <input
                :id="'article-name-' + index"
                v-model="article.article"
                type="text"
                placeholder="Ex: Pot en céramique"
                required
              />
            </div>
            <div class="form-group form-group-qty">
              <label :for="'article-qty-' + index">Qté</label>
              <input
                :id="'article-qty-' + index"
                v-model.number="article.quantite"
                type="number"
                min="1"
                required
              />
            </div>
            <div class="form-group form-group-price">
              <label :for="'article-price-' + index">Prix (€)</label>
              <input
                :id="'article-price-' + index"
                v-model.number="article.prix"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                required
              />
            </div>
          </div>
        </div>

        <div v-if="error" class="form-error">
          {{ error }}
        </div>

        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" @click="$emit('close')">
            Annuler
          </button>
          <button type="submit" class="btn btn-primary" :disabled="loading">
            {{ loading ? 'Ajout en cours...' : 'Ajouter la vente' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, computed } from 'vue'
import { useVentesStore } from '../store/ventes'
import { useArtisansStore } from '../store/artisans'

const props = defineProps({
  show: Boolean
})

const emit = defineEmits(['close'])

const ventesStore = useVentesStore()
const artisansStore = useArtisansStore()
const artisans = computed(() => artisansStore.artisans)
const loading = ref(false)
const error = ref(null)

const emptyArticle = () => ({
  article: '',
  quantite: 1,
  prix: ''
})

const form = reactive({
  date_vente: new Date().toISOString().split('T')[0],
  artisan_id: '',
  type_paiement: '',
  articles: [{ ...emptyArticle() }]
})

// Charger les artisans quand le modal s'ouvre
watch(() => props.show, async (newVal) => {
  if (newVal) {
    if (artisansStore.artisans.length === 0) {
      try {
        await artisansStore.fetchArtisans()
      } catch (err) {
        error.value = 'Erreur lors du chargement des artisans'
      }
    }
  } else {
    // Réinitialiser le formulaire
    form.date_vente = new Date().toISOString().split('T')[0]
    form.artisan_id = ''
    form.type_paiement = ''
    form.articles = [{ ...emptyArticle() }]
    error.value = null
  }
})

function addArticle() {
  form.articles.push({ ...emptyArticle() })
}

function removeArticle(index) {
  if (form.articles.length > 1) {
    form.articles.splice(index, 1)
  }
}

async function handleSubmit() {
  loading.value = true
  error.value = null

  try {
    // Construire les données pour l'API
    const articlesData = form.articles.map(a => ({
      article: a.article,
      quantite: a.quantite || 1,
      prix: parseFloat(a.prix)
    }))

    await ventesStore.addVente({
      articles: articlesData,
      type_paiement: form.type_paiement,
      artisan_id: form.artisan_id,
      date_vente: form.date_vente
    })
    emit('close')
  } catch (err) {
    error.value = err.response?.data?.error || "Erreur lors de l'ajout de la vente"
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 20px;
}

.modal-card {
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 580px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  animation: slideIn 0.2s ease-out;
}

.modal-card-wide {
  max-width: 680px;
}

@keyframes slideIn {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
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

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 600;
  font-size: 0.85rem;
  color: #374151;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.9rem;
  transition: border-color 0.2s;
  box-sizing: border-box;
  background: white;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
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
  grid-template-columns: 1fr 80px 110px;
}

.form-group-article {
  margin-bottom: 0;
}

.form-group-qty,
.form-group-price {
  margin-bottom: 0;
}

.btn-sm {
  font-size: 0.8rem;
  padding: 6px 12px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, transform 0.1s;
}

.btn:active {
  transform: scale(0.97);
}

.btn-primary {
  background: #4f46e5;
  color: white;
}

.btn-primary:hover {
  background: #4338ca;
}

.btn-primary:disabled {
  background: #a5b4fc;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f1f5f9;
  color: #475569;
}

.btn-secondary:hover {
  background: #e2e8f0;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}
</style>