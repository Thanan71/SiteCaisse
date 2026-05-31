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

    <!-- Sous-navigation : Graphiques / Ventes -->
    <div v-if="rapportsStore.allRapports.length || rapportsStore.ventesArtisan.length" class="sub-nav">
      <button
        class="sub-nav-btn"
        :class="{ active: activeTab === 'graphiques' }"
        @click="activeTab = 'graphiques'"
      >
        📊 Graphiques
      </button>
      <button
        class="sub-nav-btn"
        :class="{ active: activeTab === 'ventes' }"
        @click="activeTab = 'ventes'"
      >
        📋 Liste des ventes
      </button>
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

      <!-- Onglet : Graphiques (vue globale) -->
      <div v-if="activeTab === 'graphiques' && rapportsStore.allRapports.length">
        <GraphiquesRapports
          :ventes-data="allVentesFlat"
          :is-global="true"
          :groupes-data="rapportsStore.allRapports"
        />
      </div>

      <!-- Onglet : Liste des ventes (vue globale) -->
      <div v-if="activeTab === 'ventes' && rapportsStore.allRapports.length">
        <RapportVentesTable
          v-for="groupe in rapportsStore.allRapports"
          :key="'groupe-' + groupe.artisan_id"
          :title="groupe.artisan_nom"
          :ventes="groupe.ventes"
          :summary="groupe.summary"
          :total-label="`TOTAL ${groupe.artisan_nom.toUpperCase()}`"
        />

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

      <!-- Onglet : Graphiques (artisan spécifique) -->
      <div v-if="activeTab === 'graphiques' && rapportsStore.ventesArtisan.length">
        <GraphiquesRapports
          :ventes-data="rapportsStore.ventesArtisan"
          :is-global="false"
        />
      </div>

      <!-- Onglet : Liste des ventes (artisan spécifique) -->
      <div v-if="activeTab === 'ventes' && rapportsStore.ventesArtisan.length">
        <RapportVentesTable
          :ventes="rapportsStore.ventesArtisan"
          :summary="rapportsStore.summary"
          total-label="TOTAL"
        />

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
import { computed, onMounted, ref } from 'vue'
import GraphiquesRapports from '../components/GraphiquesRapports.vue'
import RapportVentesTable from '../components/RapportVentesTable.vue'
import { exportAllRapportsToExcel } from '../services/excelService'
import { useArtisansStore } from '../store/artisans'
import { useRapportsStore } from '../store/rapports'
import { formatPrice } from '../utils/formatters'

const rapportsStore = useRapportsStore()
const artisansStore = useArtisansStore()
const selectedArtisanId = ref('')
const activeTab = ref('graphiques')

const permanents = computed(() => artisansStore.permanents)
const temporaires = computed(() => artisansStore.temporaires)

/**
 * Aplatit toutes les ventes de tous les groupes pour les graphiques en mode global.
 */
const allVentesFlat = computed(() => {
  const ventes = []
  for (const groupe of rapportsStore.allRapports) {
    for (const vente of groupe.ventes) {
      ventes.push(vente)
    }
  }
  return ventes
})

onMounted(() => {
  artisansStore.fetchArtisans()
  rapportsStore.fetchAllRapports()
})

function onArtisanChange() {
  activeTab.value = 'graphiques'
  if (selectedArtisanId.value) {
    rapportsStore.fetchVentesByArtisan(selectedArtisanId.value)
  }
}

function exportAllToExcel() {
  exportAllRapportsToExcel(
    rapportsStore.allRapports,
    rapportsStore.totalGlobal,
    rapportsStore.totalAllParams,
  )
}
</script>

<style scoped>
.rapports-page {
  padding: 24px;
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

.empty-state {
  text-align: center;
  padding: 60px 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
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

/* Sous-navigation */
.sub-nav {
  display: flex;
  gap: 4px;
  margin-bottom: 24px;
  background: white;
  border-radius: 12px;
  padding: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.sub-nav-btn {
  flex: 1;
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  background: transparent;
  color: #64748b;
  transition: all 0.2s;
}

.sub-nav-btn:hover {
  background: #f1f5f9;
  color: #475569;
}

.sub-nav-btn.active {
  background: #4f46e5;
  color: white;
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
