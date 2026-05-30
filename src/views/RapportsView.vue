<template>
  <div class="rapports-page">
    <div class="page-header">
      <div>
        <h1>Rapports</h1>
        <p class="page-subtitle">Consultez les ventes par artisan</p>
      </div>
    </div>

    <div class="filters-card">
      <div class="form-group">
        <label for="artisan-select">Sélectionner un artisan</label>
        <select
          id="artisan-select"
          v-model="selectedArtisanId"
          @change="loadVentes"
          class="artisan-select"
        >
          <option value="">-- Choisir un artisan --</option>
          <optgroup label="Artisans permanents">
            <option
              v-for="a in permanents"
              :key="a.id"
              :value="a.id"
            >
              {{ a.nom }}
            </option>
          </optgroup>
          <optgroup label="Artisans temporaires">
            <option
              v-for="a in temporaires"
              :key="a.id"
              :value="a.id"
            >
              {{ a.nom }}
            </option>
          </optgroup>
        </select>
      </div>
    </div>

    <div v-if="!selectedArtisanId" class="empty-state">
      <div class="empty-icon">📊</div>
      <h3>Sélectionnez un artisan</h3>
      <p>Choisissez un artisan dans la liste ci-dessus pour voir son rapport</p>
    </div>

    <div v-else-if="rapportsStore.loading" class="loading-state">
      <div class="spinner"></div>
      <p>Chargement du rapport...</p>
    </div>

    <div v-else-if="!rapportsStore.ventesArtisan.length" class="empty-state">
      <div class="empty-icon">📭</div>
      <h3>Aucune vente</h3>
      <p>Cet artisan n'a pas encore de ventes enregistrées</p>
    </div>

    <div v-else>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Article</th>
              <th>Quantité</th>
              <th>Prix unitaire</th>
              <th>Total</th>
              <th>Paiement</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="vente in rapportsStore.ventesArtisan" :key="vente.id">
              <td>{{ formatDate(vente.date_vente) }}</td>
              <td class="article-name">{{ vente.article }}</td>
              <td class="text-center">{{ vente.quantite }}</td>
              <td class="text-right">{{ formatPrice(vente.prix) }}</td>
              <td class="text-right total-price">{{ formatPrice(vente.prix * vente.quantite) }}</td>
              <td>
                <span class="payment-badge" :class="'payment-' + vente.type_paiement.toLowerCase()">
                  {{ getPaymentLabel(vente.type_paiement) }}
                </span>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="summary-row">
              <td colspan="2"><strong>TOTAL</strong></td>
              <td class="text-center"><strong>{{ rapportsStore.summary.total_articles }}</strong></td>
              <td></td>
              <td class="text-right"><strong class="total-sum">{{ formatPrice(rapportsStore.summary.total_montant) }}</strong></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div class="export-section">
        <button class="btn btn-success" @click="rapportsStore.exportToExcel(artisansStore.artisans)">
          📥 Télécharger en Excel
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRapportsStore } from '../store/rapports'
import { useArtisansStore } from '../store/artisans'

const rapportsStore = useRapportsStore()
const artisansStore = useArtisansStore()
const selectedArtisanId = ref('')

const permanents = computed(() => artisansStore.permanents)
const temporaires = computed(() => artisansStore.temporaires)

onMounted(() => {
  artisansStore.fetchArtisans()
})

function loadVentes() {
  if (selectedArtisanId.value) {
    rapportsStore.fetchVentesByArtisan(selectedArtisanId.value)
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

function formatPrice(price) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR'
  }).format(price)
}

function getPaymentLabel(type) {
  const labels = {
    CB: 'Carte Bancaire',
    Espece: 'Espèce',
    Cheque: 'Chèque'
  }
  return labels[type] || type
}
</script>

<style scoped>
.rapports-page {
  padding: 24px;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  margin: 0;
  font-size: 1.5rem;
  color: #1e293b;
}

.page-subtitle {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 0.9rem;
}

.filters-card {
  background: white;
  border-radius: 12px;
  padding: 20px 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  margin-bottom: 24px;
}

.filters-card .form-group {
  margin: 0;
}

.filters-card label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  font-size: 0.85rem;
  color: #374151;
}

.artisan-select {
  width: 100%;
  max-width: 400px;
  padding: 10px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.9rem;
  background: white;
  transition: border-color 0.2s;
}

.artisan-select:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 60px 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e2e8f0;
  border-top-color: #4f46e5;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 16px;
}

.empty-state h3 {
  margin: 0 0 8px;
  color: #1e293b;
}

.empty-state p {
  color: #64748b;
  margin: 0;
}

.table-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead th {
  background: #f8fafc;
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
  font-size: 0.8rem;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 2px solid #e2e8f0;
  white-space: nowrap;
}

tbody td {
  padding: 12px 16px;
  border-bottom: 1px solid #f1f5f9;
  font-size: 0.9rem;
  color: #1e293b;
}

tbody tr:hover {
  background: #f8fafc;
}

tbody tr:last-child td {
  border-bottom: none;
}

tfoot td {
  padding: 16px;
  border-top: 2px solid #e2e8f0;
  font-size: 0.95rem;
}

.summary-row {
  background: #f8fafc;
}

.total-sum {
  color: #059669;
  font-size: 1.1rem;
}

.article-name {
  font-weight: 600;
}

.text-center {
  text-align: center;
}

.text-right {
  text-align: right;
}

.total-price {
  font-weight: 600;
  color: #059669;
}

.payment-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
}

.payment-cb {
  background: #dbeafe;
  color: #2563eb;
}

.payment-espece {
  background: #d1fae5;
  color: #059669;
}

.payment-cheque {
  background: #fef3c7;
  color: #d97706;
}

.export-section {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>