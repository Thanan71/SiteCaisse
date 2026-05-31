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
          @change="onArtisanChange"
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

    <!-- Mode : Tous les artisans -->
    <div v-if="!selectedArtisanId">
      <div v-if="rapportsStore.loadingAll" class="loading-state">
        <div class="spinner"></div>
        <p>Chargement des rapports...</p>
      </div>

      <div v-else-if="!rapportsStore.allRapports.length" class="empty-state">
        <div class="empty-icon">📊</div>
        <h3>Sélectionnez un artisan</h3>
        <p>Choisissez un artisan dans la liste ci-dessus pour voir son rapport</p>
      </div>

      <div v-else>
        <div
          v-for="groupe in rapportsStore.allRapports"
          :key="'groupe-' + groupe.artisan_id"
          class="artisan-rapport-block"
        >
          <h2 class="artisan-rapport-title">{{ groupe.artisan_nom }}</h2>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Articles</th>
                  <th>Total Qté</th>
                  <th>Montant total</th>
                  <th>Paiement</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="vente in groupe.ventes" :key="vente.id">
                  <td>{{ formatDate(vente.date_vente) }}</td>
                  <td class="articles-cell">
                    <div v-for="(art, artIdx) in getVisibleArticles(vente, expandedGroupes, getGroupKey(groupe.artisan_id, vente.id))" :key="art.id || artIdx" class="article-line">
                      <span class="article-name-sm">{{ art.article }} × {{ art.quantite }} &nbsp;</span>
                      <span class="article-subtotal-sm">{{ formatPrice(art.prix * art.quantite) }}</span>
                    </div>
                    <button
                      v-if="vente.articles && vente.articles.length > 1"
                      class="btn-expand"
                      @click="toggleExpand(expandedGroupes, getGroupKey(groupe.artisan_id, vente.id))"
                    >
                      {{ expandedGroupes[getGroupKey(groupe.artisan_id, vente.id)] ? '▲ Moins' : `▼ +${vente.articles.length - 1} autre(s)` }}
                    </button>
                  </td>
                  <td class="text-center">{{ vente.total_articles }}</td>
                  <td class="text-right total-price">{{ formatPrice(vente.total_montant) }}</td>
                  <td>
                    <span class="payment-badge" :class="'payment-' + vente.type_paiement.toLowerCase()">
                      {{ getPaymentLabel(vente.type_paiement) }}
                    </span>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="summary-row">
                  <td colspan="2"><strong>TOTAL {{ groupe.artisan_nom.toUpperCase() }}</strong></td>
                  <td class="text-center"><strong>{{ groupe.summary.total_articles }}</strong></td>
                  <td class="text-right"><strong class="total-sum">{{ formatPrice(groupe.summary.total_montant) }}</strong></td>
                  <td></td>
                </tr>
                <!-- Ligne commission CB -->
                <tr v-if="groupe.summary.commission_cb > 0" class="commission-row">
                  <td colspan="4" class="text-right">
                    <span class="commission-label">
                      Commission CB ({{ groupe.summary.taux_commission }}% sur {{ formatPrice(groupe.summary.total_cb) }})
                    </span>
                  </td>
                  <td class="text-right">
                    <span class="commission-value">- {{ formatPrice(groupe.summary.commission_cb) }}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <!-- Résumé global -->
        <div class="global-summary-card">
          <h3>Résumé global</h3>
          <div class="global-summary-stats">
            <div class="stat">
              <span class="stat-label">Total articles</span>
              <span class="stat-value">{{ rapportsStore.totalGlobal.total_articles }}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Total montant</span>
              <span class="stat-value stat-value-amount">{{ formatPrice(rapportsStore.totalGlobal.total_montant) }}</span>
            </div>
            <div v-if="rapportsStore.totalGlobal.total_cb > 0" class="stat">
              <span class="stat-label">Total CB</span>
              <span class="stat-value stat-value-cb">{{ formatPrice(rapportsStore.totalGlobal.total_cb) }}</span>
            </div>
            <div v-if="rapportsStore.totalGlobal.total_commission > 0" class="stat">
              <span class="stat-label">Commission CB totale</span>
              <span class="stat-value stat-value-commission">{{ formatPrice(rapportsStore.totalGlobal.total_commission) }}</span>
            </div>
          </div>
          <div v-if="rapportsStore.totalGlobal.total_commission > 0" class="commission-detail">
            <span v-if="rapportsStore.totalAllParams">
              Taux : Permanent {{ rapportsStore.totalAllParams.commission_cb_permanent }}% / Temporaire {{ rapportsStore.totalAllParams.commission_cb_temporaire }}%
            </span>
          </div>
        </div>

        <div class="export-section">
          <button class="btn btn-success" @click="exportAllToExcel">
            📥 Télécharger tout en Excel
          </button>
        </div>
      </div>
    </div>

    <!-- Mode : Artisan spécifique -->
    <div v-else>
      <div v-if="rapportsStore.loading" class="loading-state">
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
                <th>Articles</th>
                <th>Total Qté</th>
                <th>Montant total</th>
                <th>Paiement</th>
              </tr>
            </thead>
              <tbody>
              <tr v-for="vente in rapportsStore.ventesArtisan" :key="vente.id">
                <td>{{ formatDate(vente.date_vente) }}</td>
                <td class="articles-cell">
                  <div v-for="(art, artIdx) in getVisibleArticles(vente, expandedArtisan, 'a' + vente.id)" :key="art.id || artIdx" class="article-line">
                    <span class="article-name-sm">{{ art.article }} × {{ art.quantite }} &nbsp;</span>
                    <span class="article-subtotal-sm">{{ formatPrice(art.prix * art.quantite) }}</span>
                  </div>
                  <button
                    v-if="vente.articles && vente.articles.length > 1"
                    class="btn-expand"
                    @click="toggleExpand(expandedArtisan, 'a' + vente.id)"
                  >
                    {{ expandedArtisan['a' + vente.id] ? '▲ Moins' : `▼ +${vente.articles.length - 1} autre(s)` }}
                  </button>
                </td>
                <td class="text-center">{{ vente.total_articles }}</td>
                <td class="text-right total-price">{{ formatPrice(vente.total_montant) }}</td>
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
                <td class="text-right"><strong class="total-sum">{{ formatPrice(rapportsStore.summary.total_montant) }}</strong></td>
                <td></td>
              </tr>
              <!-- Ligne commission CB -->
              <tr v-if="rapportsStore.summary.commission_cb > 0" class="commission-row">
                <td colspan="4" class="text-right">
                  <span class="commission-label">
                    Commission CB ({{ rapportsStore.summary.taux_commission }}% sur {{ formatPrice(rapportsStore.summary.total_cb) }})
                  </span>
                </td>
                <td class="text-right">
                  <span class="commission-value">- {{ formatPrice(rapportsStore.summary.commission_cb) }}</span>
                </td>
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRapportsStore } from '../store/rapports'
import { useArtisansStore } from '../store/artisans'
import { exportVentesToExcel, exportAllRapportsToExcel } from '../services/excelService'

const rapportsStore = useRapportsStore()
const artisansStore = useArtisansStore()
const selectedArtisanId = ref('')
const expandedGroupes = ref({})
const expandedArtisan = ref({})

const permanents = computed(() => artisansStore.permanents)
const temporaires = computed(() => artisansStore.temporaires)

function getVisibleArticles(vente, expandedMap, key) {
  if (!vente.articles) return []
  if (vente.articles.length <= 1 || expandedMap[key]) {
    return vente.articles
  }
  return [vente.articles[0]]
}

function toggleExpand(expandedMap, key) {
  expandedMap[key] = !expandedMap[key]
}

function getGroupKey(groupeId, venteId) {
  return `g${groupeId}-v${venteId}`
}

onMounted(() => {
  artisansStore.fetchArtisans()
  rapportsStore.fetchAllRapports()
})

function onArtisanChange() {
  if (selectedArtisanId.value) {
    rapportsStore.fetchVentesByArtisan(selectedArtisanId.value)
  }
}

function exportAllToExcel() {
  exportAllRapportsToExcel(rapportsStore.allRapports, rapportsStore.totalGlobal, rapportsStore.totalAllParams)
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

/* Blocs par artisan */
.artisan-rapport-block {
  margin-bottom: 32px;
}

.artisan-rapport-title {
  font-size: 1.15rem;
  color: #1e293b;
  margin: 0 0 12px;
  padding-bottom: 8px;
  border-bottom: 2px solid #e2e8f0;
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

/* Commission row */
.commission-row td {
  padding: 10px 16px;
  border-top: 1px dashed #e2e8f0;
  font-size: 0.85rem;
}

.commission-label {
  color: #64748b;
  font-size: 0.85rem;
}

.commission-value {
  color: #ef4444;
  font-weight: 600;
  font-size: 0.95rem;
}

.btn-expand {
  background: none;
  border: 1px solid #e2e8f0;
  color: #4f46e5;
  cursor: pointer;
  font-size: 0.75rem;
  padding: 3px 10px;
  border-radius: 6px;
  margin-top: 6px;
  transition: background 0.2s, border-color 0.2s;
}

.btn-expand:hover {
  background: #f1f5f9;
  border-color: #4f46e5;
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

/* Carte résumé global */
.global-summary-card {
  background: white;
  border-radius: 12px;
  padding: 20px 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  margin-bottom: 24px;
  border: 2px solid #4f46e5;
}

.global-summary-card h3 {
  margin: 0 0 16px;
  font-size: 1.1rem;
  color: #1e293b;
}

.global-summary-stats {
  display: flex;
  gap: 40px;
  flex-wrap: wrap;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 0.85rem;
  color: #64748b;
  font-weight: 500;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1e293b;
}

.stat-value-amount {
  color: #059669;
}

.stat-value-cb {
  color: #2563eb;
}

.stat-value-commission {
  color: #ef4444;
}

.commission-detail {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
  font-size: 0.8rem;
  color: #64748b;
}
</style>