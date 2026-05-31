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
              <div class="article-line" v-for="(art, artIdx) in getVisibleArticles(vente)" :key="art.id || artIdx">
                <span class="article-name">{{ art.article }}</span>
                <span class="article-details">
                  {{ art.quantite }} &times; {{ formatPrice(art.prix) }}
                  <span class="article-subtotal">= {{ formatPrice(art.prix * art.quantite) }}</span>
                </span>
              </div>
              <button
                v-if="vente.articles && vente.articles.length > 1"
                class="btn-expand"
                @click="toggleExpand(vente.id)"
              >
                {{ expandedVentes[vente.id] ? '▲ Moins' : `▼ +${vente.articles.length - 1} autre(s)` }}
              </button>
            </td>
            <td>{{ vente.artisan_nom }}</td>
            <td class="text-center">{{ vente.total_articles }}</td>
            <td class="text-right total-price">{{ formatPrice(vente.total_montant) }}</td>
            <td>
              <span class="payment-badge" :class="'payment-' + vente.type_paiement.toLowerCase()">
                {{ getPaymentLabel(vente.type_paiement) }}
              </span>
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
    </div>

    <!-- Modal d'ajout -->
    <ModalAjoutVente :show="showModal" @close="showModal = false" />

    <!-- Modal de modification -->
    <ModalEditVente
      v-if="editingVente"
      :show="!!editingVente"
      :vente="editingVente"
      @close="editingVente = null"
      @saved="editingVente = null"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useVentesStore } from '../store/ventes'
import ModalAjoutVente from '../components/ModalAjoutVente.vue'
import ModalEditVente from '../components/ModalEditVente.vue'

const ventesStore = useVentesStore()
const showModal = ref(false)
const editingVente = ref(null)
const expandedVentes = ref({})

onMounted(() => {
  ventesStore.fetchVentes()
})

function getVisibleArticles(vente) {
  if (!vente.articles) return []
  if (vente.articles.length <= 1 || expandedVentes.value[vente.id]) {
    return vente.articles
  }
  // Ne montrer que le premier article
  return [vente.articles[0]]
}

function toggleExpand(venteId) {
  expandedVentes.value[venteId] = !expandedVentes.value[venteId]
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
    'CB': 'Carte Bancaire',
    'Espece': 'Espèce',
    'Cheque': 'Chèque'
  }
  return labels[type] || type
}

function openEdit(vente) {
  editingVente.value = { ...vente }
}

async function handleDelete(id) {
  if (confirm('Êtes-vous sûr de vouloir supprimer cette vente ?')) {
    try {
      await ventesStore.deleteVente(id)
    } catch (err) {
      alert('Erreur lors de la suppression')
    }
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

.loading-state,
.error-state,
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
  vertical-align: top;
}

tbody tr:hover {
  background: #f8fafc;
}

tbody tr:last-child td {
  border-bottom: none;
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

.text-center {
  text-align: center;
}

.text-right {
  text-align: right;
}

.total-price {
  font-weight: 600;
  color: #059669;
  white-space: nowrap;
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
</style>