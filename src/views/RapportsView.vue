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
          <option value="">-- Tous les artisans --</option>
          <optgroup label="Artisans permanents">
            <option
              v-for="a in permanents"
              :key="a.id"
              :value="a.id"
            >
              {{ formatArtisanSelectLabel(a) }}
            </option>
          </optgroup>
          <optgroup label="Artisans temporaires">
            <option
              v-for="a in temporaires"
              :key="a.id"
              :value="a.id"
            >
              {{ formatArtisanSelectLabel(a) }}
            </option>
          </optgroup>
        </select>
      </div>
    </div>

    <!-- Sous-navigation : Vue globale / Mensuelle / Graphiques -->
    <TabNav
      v-if="rapportsStore.allRapports.length || rapportsStore.ventesArtisan.length"
      v-model="activeTab"
      :tabs="[
        { key: 'global', label: 'Toutes les ventes', icon: '📋' },
        { key: 'mensuel', label: 'Par mois', icon: '📅' },
        { key: 'graphiques', label: 'Graphiques', icon: '📊' },
      ]"
      @change="onTabClick"
    />

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
      <div v-if="activeTab === 'global' && rapportsStore.allRapports.length">
        <div class="export-section">
          <button class="btn btn-success" @click="exportAllToExcel">
            📥 Télécharger tout en Excel
          </button>
        </div>

        <div class="rapport-list-wrapper">
          <RapportVentesTable
            v-for="groupe in rapportsStore.allRapports"
            :key="'groupe-' + groupe.artisan_id"
            :title="groupe.artisan_nom"
            :ventes="groupe.ventes"
            :summary="groupe.summary"
            :total-label="`TOTAL ${groupe.artisan_nom.toUpperCase()}`"
          />

          <!-- Résumé global -->
          <SummaryCard
            title="Résumé global"
            :total-articles="rapportsStore.totalGlobal.total_articles"
            :total-montant="rapportsStore.totalGlobal.total_montant"
            :total-cb="rapportsStore.totalGlobal.total_cb"
            :total-commission="rapportsStore.totalGlobal.total_commission"
            :commission-detail="rapportsStore.totalGlobal.total_commission > 0 && rapportsStore.totalAllParams
              ? `Taux généraux : Permanent ${rapportsStore.totalAllParams.commission_cb_permanent}% / Temporaire ${rapportsStore.totalAllParams.commission_cb_temporaire}%`
              : ''"
            commission-label-suffix=" totale"
            variant="primary"
          />
        </div>
      </div>

      <!-- Onglet : Vue mensuelle -->
      <div v-if="activeTab === 'mensuel'">
        <!-- Sélecteur de mois avec mois courant par défaut -->
        <MonthSelector v-model="selectedMonth" @change="onMonthChange">
          <template #actions>
            <button
              class="btn btn-success"
              :disabled="!rapportsStore.rapportMois || !rapportsStore.rapportMois.groupes.length"
              @click="exportMonthToExcelFn"
            >
              📥 Télécharger le rapport Excel
            </button>
          </template>
        </MonthSelector>

        <div v-if="rapportsStore.loadingMois" class="loading-state">
          <div class="spinner"></div>
          <p>Chargement du rapport mensuel...</p>
        </div>

        <div v-else-if="!rapportsStore.rapportMois || !rapportsStore.rapportMois.groupes.length" class="empty-state">
          <div class="empty-icon">📅</div>
          <h3>Aucune donnée pour {{ formatMonthLabel(selectedMonth) }}</h3>
          <p>Aucune vente enregistrée pour ce mois</p>
        </div>

        <template v-else>
          <div class="month-block">
            <h2 class="month-title">{{ formatMonthLabel(selectedMonth) }}</h2>

            <div class="rapport-list-wrapper">
              <RapportVentesTable
                v-for="groupe in rapportsStore.rapportMois.groupes"
                :key="'groupe-' + groupe.artisan_id"
                :title="groupe.artisan_nom"
                :ventes="groupe.ventes"
                :summary="groupe.summary"
                :total-label="`TOTAL ${groupe.artisan_nom.toUpperCase()}`"
              />

              <!-- Résumé du mois -->
              <SummaryCard
                title="Résumé du mois"
                :total-articles="rapportsStore.rapportMois.total.total_articles"
                :total-montant="rapportsStore.rapportMois.total.total_montant"
                :total-cb="rapportsStore.rapportMois.total.total_cb"
                :total-commission="rapportsStore.rapportMois.total.total_commission"
                :commission-detail="rapportsStore.rapportMois.total.total_commission > 0 && rapportsStore.rapportMois.parametres
                  ? `Taux généraux : Permanent ${rapportsStore.rapportMois.parametres.commission_cb_permanent}% / Temporaire ${rapportsStore.rapportMois.parametres.commission_cb_temporaire}%`
                  : ''"
                variant="warning"
              />
          </div>
        </div>
        </template>
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

      <div v-if="(activeTab === 'ventes' || activeTab === 'global') && rapportsStore.ventesArtisan.length">
        <div class="export-section">
          <button class="btn btn-success" @click="rapportsStore.exportToExcel(artisansStore.artisans)">
            📥 Télécharger en Excel
          </button>
        </div>

        <div class="rapport-list-wrapper">
          <RapportVentesTable
            :ventes="rapportsStore.ventesArtisan"
            :summary="rapportsStore.summary"
            total-label="TOTAL"
          />
        </div>
      </div>

      <div v-if="activeTab === 'mensuel'">
        <MonthSelector v-model="selectedMonth" @change="onMonthChange">
          <template #actions>
            <button
              class="btn btn-success"
              :disabled="!selectedArtisanRapportMoisGroup"
              @click="exportSelectedArtisanMonthToExcel"
            >
              📥 Télécharger le rapport Excel
            </button>
          </template>
        </MonthSelector>

        <div v-if="rapportsStore.loadingMois" class="loading-state">
          <div class="spinner"></div>
          <p>Chargement du rapport mensuel...</p>
        </div>

        <div v-else-if="!selectedArtisanRapportMoisGroup" class="empty-state">
          <div class="empty-icon">📅</div>
          <h3>Aucune donnée pour {{ selectedArtisan?.nom || 'cet artisan' }} en {{ formatMonthLabel(selectedMonth) }}</h3>
          <p>Aucune vente enregistrée pour ce mois</p>
        </div>

        <template v-else>
          <div class="month-block">
            <h2 class="month-title">Rapport mensuel - {{ selectedArtisan?.nom || 'Artisan' }} ({{ formatMonthLabel(selectedMonth) }})</h2>

            <div class="rapport-list-wrapper">
              <RapportVentesTable
                :title="selectedArtisan?.nom"
                :ventes="selectedArtisanRapportMoisGroup.ventes"
                :summary="selectedArtisanRapportMoisGroup.summary"
                :total-label="`TOTAL ${selectedArtisan?.nom?.toUpperCase() || ''}`"
              />

              <SummaryCard
                title="Résumé du mois"
                :total-articles="selectedArtisanRapportMoisGroup.summary.total_articles"
                :total-montant="selectedArtisanRapportMoisGroup.summary.total_montant"
                :total-cb="selectedArtisanRapportMoisGroup.summary.total_cb"
                :total-commission="selectedArtisanRapportMoisGroup.summary.total_commission"
                :commission-detail="selectedArtisanRapportMoisGroup.summary.total_commission > 0 && rapportsStore.rapportMois?.parametres
                  ? `Taux généraux : Permanent ${rapportsStore.rapportMois.parametres.commission_cb_permanent}% / Temporaire ${rapportsStore.rapportMois.parametres.commission_cb_temporaire}%`
                  : ''"
                commission-label-suffix=" totale"
                variant="warning"
              />
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import DataState from '../components/DataState.vue'
import GraphiquesRapports from '../components/GraphiquesRapports.vue'
import MonthSelector from '../components/MonthSelector.vue'
import RapportVentesTable from '../components/RapportVentesTable.vue'
import SummaryCard from '../components/SummaryCard.vue'
import TabNav from '../components/TabNav.vue'
import { exportAllRapportsToExcel, exportMonthToExcel } from '../services/excelService'
import { useArtisansStore } from '../store/artisans'
import { useRapportsStore } from '../store/rapports'
import { formatMonthLabel, formatPrice } from '../utils/formatters'

const rapportsStore = useRapportsStore()
const artisansStore = useArtisansStore()
const selectedArtisanId = ref('')
const activeTab = ref('global')

// Mois courant au format YYYY-MM
const now = new Date()
const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
const selectedMonth = ref(currentMonth)

const permanents = computed(() => artisansStore.permanents)
const temporaires = computed(() => artisansStore.temporaires)

const selectedArtisan = computed(() => {
  if (!selectedArtisanId.value) return null
  return (
    artisansStore.artisans.find((a) => String(a.id) === String(selectedArtisanId.value)) || null
  )
})

const selectedArtisanRapportMoisGroup = computed(() => {
  if (!selectedArtisanId.value || !rapportsStore.rapportMois?.groupes) return null
  return (
    rapportsStore.rapportMois.groupes.find(
      (g) => String(g.artisan_id) === String(selectedArtisanId.value),
    ) || null
  )
})

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
  artisansStore.fetchArtisans({ includeInactive: true })
  rapportsStore.fetchAllRapports()
  // Charger les données du mois courant pour l'onglet mensuel
  rapportsStore.fetchRapportByMonth(currentMonth)
})

function formatArtisanSelectLabel(artisan) {
  const name = artisan.nom_boutique || artisan.nom
  return artisan.est_actif === false ? `${name} (archivé)` : name
}

function onArtisanChange() {
  activeTab.value = 'global'
  if (selectedArtisanId.value) {
    rapportsStore.fetchVentesByArtisan(selectedArtisanId.value)
  }
}

function onMonthChange() {
  if (selectedMonth.value) {
    rapportsStore.fetchRapportByMonth(selectedMonth.value)
  }
}

function onTabClick(tab) {
  activeTab.value = tab

  if (tab === 'mensuel' && selectedMonth.value) {
    rapportsStore.fetchRapportByMonth(selectedMonth.value)
  }
}

function exportAllToExcel() {
  exportAllRapportsToExcel(
    rapportsStore.allRapports,
    rapportsStore.totalGlobal,
    rapportsStore.totalAllParams,
  )
}

function exportMonthToExcelFn() {
  if (!rapportsStore.rapportMois) return
  exportMonthToExcel(
    rapportsStore.rapportMois.groupes,
    rapportsStore.rapportMois.total,
    rapportsStore.rapportMois.parametres,
    selectedMonth.value,
  )
}

function exportSelectedArtisanMonthToExcel() {
  if (!selectedArtisanRapportMoisGroup.value) return
  exportMonthToExcel(
    [selectedArtisanRapportMoisGroup.value],
    selectedArtisanRapportMoisGroup.value.summary,
    rapportsStore.rapportMois?.parametres,
    selectedMonth.value,
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

.export-section {
  background: white;
  border-radius: 12px;
  padding: 20px 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.rapport-list-wrapper {
  max-height: min(64vh, 720px);
  overflow-y: auto;
  padding-right: 8px;
  margin-bottom: 24px;
}

.rapport-list-wrapper::-webkit-scrollbar {
  width: 10px;
}

.rapport-list-wrapper::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.6);
  border-radius: 999px;
}

.rapport-list-wrapper::-webkit-scrollbar-track {
  background: transparent;
}

.month-block:last-of-type {
  border-bottom: none;
  margin-bottom: 32px;
}

.month-title {
  font-size: 1.4rem;
  color: #4f46e5;
  margin: 0 0 24px;
  padding-bottom: 12px;
  border-bottom: 2px solid #4f46e5;
  display: flex;
  align-items: center;
  gap: 8px;
}

.month-title::before {
  content: '📅';
  font-size: 1.3rem;
}
</style>
