<template>
  <div class="ventes-page">
    <div class="page-header">
      <div>
        <h1>Ventes</h1>
        <p class="page-subtitle">Liste des ventes enregistrées</p>
      </div>
      <button class="btn btn-primary" @click="showModal = true">
        + Ajouter une vente
      </button>
    </div>

    <!-- Filtres avancés -->
    <div class="filters-card">
      <div class="filters-row">
        <div class="filter-group">
          <label for="filter-date-debut">Date début</label>
          <input
            id="filter-date-debut"
            type="date"
            v-model="localFilters.date_debut"
            class="filter-input"
          />
        </div>
        <div class="filter-group">
          <label for="filter-date-fin">Date fin</label>
          <input
            id="filter-date-fin"
            type="date"
            v-model="localFilters.date_fin"
            class="filter-input"
          />
        </div>
        <div class="filter-group">
          <label for="filter-type-paiement">Type de paiement</label>
          <select
            id="filter-type-paiement"
            v-model="localFilters.type_paiement"
            class="filter-input"
          >
            <option value="">Tous</option>
            <option value="CB">Carte Bancaire</option>
            <option value="Espece">Espèce</option>
            <option value="Cheque">Chèque</option>
          </select>
        </div>
        <div class="filter-actions">
          <button class="btn btn-sm btn-primary" @click="applyFilters">
            🔍 Filtrer
          </button>
          <button
            v-if="ventesStore.hasActiveFilters"
            class="btn btn-sm btn-secondary"
            @click="resetFilters"
          >
            ✕ Réinitialiser
          </button>
        </div>
      </div>
      <div v-if="ventesStore.hasActiveFilters" class="active-filters-info">
        <span class="badge badge-info">
          Filtres actifs
        </span>
        <span v-if="localFilters.date_debut" class="filter-chip">
          Du {{ formatDate(localFilters.date_debut) }}
        </span>
        <span v-if="localFilters.date_fin" class="filter-chip">
          Au {{ formatDate(localFilters.date_fin) }}
        </span>
        <span v-if="localFilters.type_paiement" class="filter-chip">
          {{ getPaymentLabel(localFilters.type_paiement) }}
        </span>
      </div>
    </div>

    <!-- Sous-navigation -->
    <div class="sub-nav">
      <button
        class="sub-nav-btn"
        :class="{ active: activeTab === 'journalier' }"
        @click="setActiveTab('journalier')"
      >
        📆 Journalier
      </button>
      <button
        class="sub-nav-btn"
        :class="{ active: activeTab === 'mensuel' }"
        @click="setActiveTab('mensuel')"
      >
        📅 Par mois
      </button>
      <button
        class="sub-nav-btn"
        :class="{ active: activeTab === 'toutes' }"
        @click="setActiveTab('toutes')"
      >
        📋 Toutes les ventes
      </button>
    </div>

    <!-- Onglet : Toutes les ventes -->
    <div v-if="activeTab === 'toutes'">
      <div v-if="ventesStore.loading && !ventesStore.ventes.length" class="loading-state">
        <div class="spinner"></div>
        <p>Chargement des ventes...</p>
      </div>

      <div v-else-if="ventesStore.error" class="error-state">
        <p>{{ ventesStore.error }}</p>
        <button class="btn btn-secondary" @click="ventesStore.fetchVentes()">Réessayer</button>
      </div>

      <div v-else-if="!ventesStore.ventes.length" class="empty-state">
        <div class="empty-icon">📋</div>
        <h3>Aucune vente</h3>
        <p>Commencez par ajouter une vente</p>
      </div>

      <div v-else>
        <VentesTable
          :ventes="ventesStore.ventes"
          show-artisan
          show-vendeur
          show-actions
          @edit="openEdit"
          @delete="handleDelete"
        />

        <!-- Pagination -->
        <div v-if="ventesStore.pagination.totalPages > 1" class="pagination-bar">
          <div class="pagination-info">
            Page {{ ventesStore.pagination.page }} / {{ ventesStore.pagination.totalPages }}
            ({{ ventesStore.pagination.total }} ventes)
          </div>
          <div class="pagination-controls">
            <button
              class="btn btn-pagination"
              :disabled="!ventesStore.hasPrevPage"
              @click="ventesStore.prevPage()"
            >
              ◀ Précédent
            </button>
            <button
              v-for="p in displayedPages"
              :key="p"
              class="btn btn-pagination"
              :class="{ active: p === ventesStore.pagination.page }"
              @click="ventesStore.goToPage(p)"
            >
              {{ p }}
            </button>
            <button
              class="btn btn-pagination"
              :disabled="!ventesStore.hasNextPage"
              @click="ventesStore.nextPage()"
            >
              Suivant ▶
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Onglet : Par mois -->
    <!-- Onglet : Journalier -->
    <div v-if="activeTab === 'journalier'">
      <div v-if="ventesStore.loading && !ventesStore.ventes.length" class="loading-state">
        <div class="spinner"></div>
        <p>Chargement des ventes du jour...</p>
      </div>

      <div v-else-if="ventesStore.error" class="error-state">
        <p>{{ ventesStore.error }}</p>
        <button class="btn btn-secondary" @click="fetchJournalier()">Réessayer</button>
      </div>

      <div v-else-if="!dailyVentes.length" class="empty-state">
        <div class="empty-icon">📆</div>
        <h3>Aucune vente aujourd'hui</h3>
        <p>Commencez par ajouter une vente</p>
      </div>

      <div v-else>
        <VentesTable
          :ventes="dailyVentes"
          :summary="dailySummary"
          totalLabel="Total journée"
          show-artisan
          show-vendeur
          show-actions
          @edit="openEdit"
          @delete="handleDelete"
        />

        <!-- Résumé du jour -->
        <div class="global-summary-card month-summary-card">
          <h3>Résumé du jour</h3>
          <div class="global-summary-stats">
            <div class="stat">
              <span class="stat-label">Total articles</span>
              <span class="stat-value">{{ dailySummary.total_articles }}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Total montant</span>
              <span class="stat-value stat-value-amount">{{ formatPrice(dailySummary.total_montant) }}</span>
            </div>
            <div v-if="dailySummary.total_cb > 0" class="stat">
              <span class="stat-label">Total CB</span>
              <span class="stat-value stat-value-cb">{{ formatPrice(dailySummary.total_cb) }}</span>
            </div>
            <div v-if="dailySummary.commission_cb > 0" class="stat">
              <span class="stat-label">Commission CB</span>
              <span class="stat-value stat-value-commission">{{ formatPrice(dailySummary.commission_cb) }}</span>
            </div>
          </div>
          <div v-if="dailySummary.commission_cb > 0" class="commission-detail">
            <span>
              Taux : Permanent {{ dailySummary.taux_commission }}%
            </span>
          </div>
        </div>
      </div>
    </div>
    <div v-if="activeTab === 'mensuel'">
      <!-- Sélecteur de mois avec mois courant par défaut -->
      <div class="month-selector-card">
        <div class="month-selector-row">
          <label for="month-select">Sélectionner un mois :</label>
          <input
            id="month-select"
            type="month"
            v-model="selectedMonth"
            @change="onMonthChange"
            class="month-input"
          />
        </div>
      </div>

      <div v-if="rapportsStore.loadingMois" class="loading-state">
        <div class="spinner"></div>
        <p>Chargement des ventes du mois...</p>
      </div>

      <div v-else-if="!rapportsStore.rapportMois" class="empty-state">
        <div class="empty-icon">📅</div>
        <h3>Sélectionnez un mois</h3>
        <p>Choisissez un mois dans le sélecteur ci-dessus</p>
      </div>

      <template v-else>
        <div class="month-block">
          <h2 class="month-title">{{ formatMonthLabel(selectedMonth) }}</h2>

          <div v-if="rapportsStore.rapportMois.groupes.length" class="month-table-container">
            <VentesTable
              :ventes="monthlyVentes"
              row-key-prefix="mens-"
              show-artisan
              show-vendeur
              show-actions
              @edit="openEdit"
              @delete="handleDelete"
            />
          </div>

          <div v-else class="empty-state">
            <div class="empty-icon">📭</div>
            <p>Aucune vente pour ce mois</p>
          </div>

          <!-- Résumé du mois -->
          <div class="global-summary-card month-summary-card">
            <h3>Résumé du mois</h3>
            <div class="global-summary-stats">
              <div class="stat">
                <span class="stat-label">Total articles</span>
                <span class="stat-value">{{ rapportsStore.rapportMois.total.total_articles }}</span>
              </div>
              <div class="stat">
                <span class="stat-label">Total montant</span>
                <span class="stat-value stat-value-amount">{{ formatPrice(rapportsStore.rapportMois.total.total_montant) }}</span>
              </div>
              <div v-if="rapportsStore.rapportMois.total.total_cb > 0" class="stat">
                <span class="stat-label">Total CB</span>
                <span class="stat-value stat-value-cb">{{ formatPrice(rapportsStore.rapportMois.total.total_cb) }}</span>
              </div>
              <div v-if="rapportsStore.rapportMois.total.total_commission > 0" class="stat">
                <span class="stat-label">Commission CB</span>
                <span class="stat-value stat-value-commission">{{ formatPrice(rapportsStore.rapportMois.total.total_commission) }}</span>
              </div>
            </div>
            <div v-if="rapportsStore.rapportMois.total.total_commission > 0" class="commission-detail">
              <span v-if="rapportsStore.rapportMois.parametres">
                Taux : Permanent {{ rapportsStore.rapportMois.parametres.commission_cb_permanent }}% / Temporaire {{ rapportsStore.rapportMois.parametres.commission_cb_temporaire }}%
              </span>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Modal d'ajout -->
    <VenteFormModal mode="create" :show="showModal" @close="showModal = false" @saved="handleVenteSaved" />

    <!-- Modal de modification -->
    <VenteFormModal
      v-if="editingVente"
      mode="edit"
      :show="!!editingVente"
      :vente="editingVente"
      @close="editingVente = null"
      @saved="handleVenteSaved"
    />

    <!-- Modal de confirmation de suppression -->
    <ConfirmModal
      :show="showDeleteModal"
      title="Supprimer la vente"
      message="Êtes-vous sûr de vouloir supprimer cette vente ?"
      warning="Cette action est irréversible."
      confirmText="Supprimer"
      variant="danger"
      :loading="deleting"
      loadingText="Suppression en cours..."
      @confirm="confirmDelete"
      @cancel="closeDeleteModal"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import ConfirmModal from '../components/ConfirmModal.vue'
import VenteFormModal from '../components/VenteFormModal.vue'
import VentesTable from '../components/VentesTable.vue'
import { useRapportsStore } from '../store/rapports'
import { useVentesStore } from '../store/ventes'
import { formatDate, formatMonthLabel, formatPrice, getPaymentLabel } from '../utils/formatters'

const ventesStore = useVentesStore()
const rapportsStore = useRapportsStore()
const showModal = ref(false)
const editingVente = ref(null)
const activeTab = ref('journalier')

// État de la suppression
const showDeleteModal = ref(false)
const deletingId = ref(null)
const deleting = ref(false)

// État local pour les filtres (copie avant application)
const localFilters = ref({
  date_debut: '',
  date_fin: '',
  type_paiement: '',
})

// Mois courant au format YYYY-MM
const now = new Date()
const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
const selectedMonth = ref(currentMonth)
// Date courante ISO (YYYY-MM-DD)
const currentDateISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

onMounted(() => {
  // Par défaut on charge les ventes du jour et le rapport du mois courant
  fetchJournalier()
  rapportsStore.fetchRapportByMonth(currentMonth)
})

function onMonthChange() {
  if (selectedMonth.value) {
    rapportsStore.fetchRapportByMonth(selectedMonth.value)
  }
}

function setActiveTab(tab) {
  activeTab.value = tab
  if (tab === 'journalier') {
    fetchJournalier()
  } else if (tab === 'toutes') {
    ventesStore.fetchVentes({ page: 1 })
  } else if (tab === 'mensuel') {
    if (selectedMonth.value) rapportsStore.fetchRapportByMonth(selectedMonth.value)
  }
}

async function fetchJournalier() {
  await ventesStore.fetchVentes({ page: 1, limit: 1000, date_debut: currentDateISO, date_fin: currentDateISO })
}

/**
 * Calcule les pages à afficher dans la pagination.
 * Affiche max 5 pages autour de la page courante.
 */
const displayedPages = computed(() => {
  const { page, totalPages } = ventesStore.pagination
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  let start = Math.max(1, page - 2)
  let end = Math.min(totalPages, page + 2)
  if (start === 1) end = Math.min(5, totalPages)
  if (end === totalPages) start = Math.max(1, totalPages - 4)
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
})

const monthlyVentes = computed(() => flattenGroupVentes(rapportsStore.rapportMois?.groupes || []))

function applyFilters() {
  ventesStore.applyFilters({ ...localFilters.value })
}

function resetFilters() {
  localFilters.value = { date_debut: '', date_fin: '', type_paiement: '' }
  ventesStore.resetFilters()
}

async function handleVenteSaved() {
  editingVente.value = null
  if (activeTab.value === 'mensuel' && selectedMonth.value) {
    await rapportsStore.fetchRapportByMonth(selectedMonth.value)
  }
  if (activeTab.value === 'journalier') {
    await fetchJournalier()
  }
}

function openEdit(vente) {
  editingVente.value = { ...vente }
}

function handleDelete(id) {
  deletingId.value = id
  showDeleteModal.value = true
}

function closeDeleteModal() {
  showDeleteModal.value = false
  deletingId.value = null
}

function flattenGroupVentes(groupes) {
  const ventes = []
  for (const groupe of groupes) {
    for (const vente of groupe.ventes) {
      ventes.push({
        ...vente,
        artisan_nom: groupe.artisan_nom,
      })
    }
  }
  // Trier par created_at (plus récent en premier)
  return ventes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

const dailyVentes = computed(() => {
  const ventes = ventesStore.ventes || []
  const filtered = ventes.filter((v) => {
    const dateStr = v.date_vente ? String(v.date_vente).slice(0, 10) : (v.created_at ? new Date(v.created_at).toISOString().slice(0, 10) : '')
    return dateStr === currentDateISO
  })
  return filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
})

const dailySummary = computed(() => {
  const ventes = dailyVentes.value || []
  const total_articles = ventes.reduce((s, v) => s + (Number(v.total_articles) || 0), 0)
  const total_montant = ventes.reduce((s, v) => s + (Number(v.total_montant) || 0), 0)
  const total_cb = ventes.reduce((s, v) => s + ((v.type_paiement === 'CB' || v.type_paiement === 'Carte Bancaire') ? (Number(v.total_montant) || 0) : 0), 0)
  const taux_commission = rapportsStore.rapportMois?.parametres?.commission_cb_permanent || 0
  const commission_cb = 0 // calcul de commission non disponible ici sans règles serveur
  return {
    total_articles,
    total_montant,
    total_cb,
    commission_cb,
    taux_commission,
  }
})

async function confirmDelete() {
  if (!deletingId.value) return

  deleting.value = true

  try {
    await ventesStore.deleteVente(deletingId.value)
    closeDeleteModal()
    if (activeTab.value === 'mensuel' && selectedMonth.value) {
      await rapportsStore.fetchRapportByMonth(selectedMonth.value)
    }
    if (activeTab.value === 'journalier') {
      await fetchJournalier()
    }
  } catch (err) {
    closeDeleteModal()
    alert('Erreur lors de la suppression')
  } finally {
    deleting.value = false
  }
}
</script>

<style scoped>
.ventes-page {
  padding: 24px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

/* Filtres */
.filters-card {
  background: white;
  border-radius: 12px;
  padding: 20px 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  margin-bottom: 24px;
}

.filters-row {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 160px;
}

.filter-group label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #374151;
}

.filter-input {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.85rem;
  background: white;
  transition: border-color 0.2s;
}

.filter-input:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

.filter-actions {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  padding-bottom: 1px;
}

.btn-sm {
  padding: 8px 14px;
  font-size: 0.85rem;
}

.active-filters-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
  flex-wrap: wrap;
}

.badge-info {
  background: #dbeafe;
  color: #2563eb;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
}

.filter-chip {
  background: #f1f5f9;
  color: #475569;
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 0.8rem;
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

.btn-secondary {
  background: #f1f5f9;
  color: #475569;
}

.btn-secondary:hover {
  background: #e2e8f0;
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

/* Sélecteur de mois */
.month-selector-card {
  background: white;
  border-radius: 12px;
  padding: 20px 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  margin-bottom: 24px;
}

.month-selector-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.month-selector-row label {
  font-weight: 600;
  font-size: 0.85rem;
  color: #374151;
  white-space: nowrap;
}

.month-input {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.9rem;
  background: white;
  transition: border-color 0.2s;
}

.month-input:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

/* Bloc mensuel */
.month-block {
  margin-bottom: 48px;
  padding-bottom: 32px;
  border-bottom: 3px solid #e2e8f0;
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

.month-table-container {
  margin-bottom: 24px;
}

.month-table-container .actions-cell {
  white-space: nowrap;
}

.month-summary-card {
  border-color: #f59e0b;
  margin-top: 24px;
}

.global-final-card {
  border-color: #059669;
  margin-top: 24px;
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

/* Pagination */
.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-top: 1px solid #e2e8f0;
  flex-wrap: wrap;
  gap: 12px;
}

.pagination-info {
  font-size: 0.85rem;
  color: #64748b;
}

.pagination-controls {
  display: flex;
  gap: 6px;
  align-items: center;
}

.btn-pagination {
  padding: 6px 12px;
  font-size: 0.8rem;
  background: #f8fafc;
  color: #475569;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-weight: 500;
}

.btn-pagination:hover:not(:disabled) {
  background: #e2e8f0;
  border-color: #cbd5e1;
}

.btn-pagination.active {
  background: #4f46e5;
  color: white;
  border-color: #4f46e5;
}

.btn-pagination:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
