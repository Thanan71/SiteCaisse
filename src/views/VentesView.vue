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

    <div v-else class="table-container">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Articles</th>
            <th>Artisan</th>
            <th>Total articles</th>
            <th>Montant total</th>
            <th>Paiement</th>
            <th>Vendeur</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="vente in ventesStore.ventes" :key="vente.id">
            <td>{{ formatDate(vente.date_vente) }}</td>
            <td class="articles-cell">
              <div class="article-line" v-for="(art, artIdx) in getVisibleItems(vente.articles, vente.id)" :key="art.id || artIdx">
                <span class="article-name">{{ art.article }}</span>
                <span class="article-details">
                  {{ art.quantite }} &times; {{ formatPrice(art.prix) }}
                  <span class="article-subtotal">= {{ formatPrice(art.prix * art.quantite) }}</span>
                </span>
              </div>
              <button
                v-if="vente.articles && vente.articles.length > 1"
                class="btn-expand"
                @click="toggleExpanded(vente.id)"
              >
                {{ isExpanded(vente.id) ? '▲ Moins' : `▼ +${vente.articles.length - 1} autre(s)` }}
              </button>
            </td>
            <td>{{ vente.artisan_nom }}</td>
            <td class="text-center">{{ vente.total_articles }}</td>
            <td class="text-right total-price">{{ formatPrice(vente.total_montant) }}</td>
            <td>
              <PaymentBadge :type="vente.type_paiement" />
            </td>
            <td>{{ vente.vendeur_nom }}</td>
            <td>
              <button class="btn-icon" title="Modifier" @click="openEdit(vente)">
                ✏️
              </button>
              <button class="btn-icon" title="Supprimer" @click="handleDelete(vente.id)">
                🗑️
              </button>
            </td>
          </tr>
        </tbody>
      </table>

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

    <!-- Modal d'ajout -->
    <VenteFormModal mode="create" :show="showModal" @close="showModal = false" />

    <!-- Modal de modification -->
    <VenteFormModal
      v-if="editingVente"
      mode="edit"
      :show="!!editingVente"
      :vente="editingVente"
      @close="editingVente = null"
      @saved="editingVente = null"
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
import PaymentBadge from '../components/PaymentBadge.vue'
import VenteFormModal from '../components/VenteFormModal.vue'
import ConfirmModal from '../components/ConfirmModal.vue'
import { useExpandableRows } from '../composables/useExpandableRows'
import { useVentesStore } from '../store/ventes'
import { formatDate, formatPrice, getPaymentLabel } from '../utils/formatters'

const ventesStore = useVentesStore()
const showModal = ref(false)
const editingVente = ref(null)
const { getVisibleItems, isExpanded, toggleExpanded } = useExpandableRows()

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

onMounted(() => {
  ventesStore.fetchVentes()
})

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

function applyFilters() {
  ventesStore.applyFilters({ ...localFilters.value })
}

function resetFilters() {
  localFilters.value = { date_debut: '', date_fin: '', type_paiement: '' }
  ventesStore.resetFilters()
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

async function confirmDelete() {
  if (!deletingId.value) return

  deleting.value = true

  try {
    await ventesStore.deleteVente(deletingId.value)
    closeDeleteModal()
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

tbody td {
  vertical-align: top;
}

.articles-cell {
  min-width: 220px;
}

.article-line {
  display: flex;
  flex-direction: column;
  padding: 4px 0;
}

.article-line + .article-line {
  border-top: 1px dashed #e2e8f0;
  margin-top: 4px;
  padding-top: 8px;
}

.article-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: #1e293b;
}

.article-details {
  font-size: 0.8rem;
  color: #64748b;
  margin-top: 2px;
}

.article-subtotal {
  font-weight: 600;
  color: #059669;
}

.total-price {
  font-weight: 600;
  color: #059669;
  white-space: nowrap;
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

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.2s;
}

.btn-icon:hover {
  background: #f1f5f9;
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
