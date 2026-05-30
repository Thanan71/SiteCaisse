<template>
  <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card">
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
          <label for="article">Nom de l'article</label>
          <input
            id="article"
            v-model="form.article"
            type="text"
            placeholder="Ex: Pot en céramique"
            required
          />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="quantite">Quantité</label>
            <input
              id="quantite"
              v-model.number="form.quantite"
              type="number"
              min="1"
              required
            />
          </div>

          <div class="form-group">
            <label for="prix">Prix (€)</label>
            <input
              id="prix"
              v-model.number="form.prix"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              required
            />
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
import { ref, reactive, watch } from 'vue'
import axios from 'axios'
import { useVentesStore } from '../store/ventes'

const props = defineProps({
  show: Boolean
})

const emit = defineEmits(['close'])

const ventesStore = useVentesStore()
const artisans = ref([])
const loading = ref(false)
const error = ref(null)

const form = reactive({
  date_vente: new Date().toISOString().split('T')[0],
  article: '',
  quantite: 1,
  artisan_id: '',
  prix: '',
  type_paiement: ''
})

// Charger les artisans quand le modal s'ouvre
watch(() => props.show, async (newVal) => {
  if (newVal) {
    try {
      const response = await axios.get('/api/rapports/artisans')
      artisans.value = response.data
    } catch (err) {
      error.value = 'Erreur lors du chargement des artisans'
    }
  } else {
    // Réinitialiser le formulaire
    form.date_vente = new Date().toISOString().split('T')[0]
    form.article = ''
    form.quantite = 1
    form.artisan_id = ''
    form.prix = ''
    form.type_paiement = ''
    error.value = null
  }
})

async function handleSubmit() {
  loading.value = true
  error.value = null

  try {
    await ventesStore.addVente({
      article: form.article,
      quantite: form.quantite,
      prix: parseFloat(form.prix),
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

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}
</style>