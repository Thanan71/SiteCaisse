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
            <th>Article</th>
            <th>Artisan</th>
            <th>Quantité</th>
            <th>Prix unitaire</th>
            <th>Total</th>
            <th>Paiement</th>
            <th>Vendeur</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="vente in ventesStore.ventes" :key="vente.id">
            <td>{{ formatDate(vente.date_vente) }}</td>
            <td class="article-name">{{ vente.article }}</td>
            <td>{{ vente.artisan_nom }}</td>
            <td class="text-center">{{ vente.quantite }}</td>
            <td class="text-center">{{ formatPrice(vente.prix) }}</td>
            <td class="text-center total-price">{{ formatPrice(vente.prix * vente.quantite) }}</td>
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

    <!-- Modal de modification (réutilise le même composant avec les données pré-remplies) -->
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

onMounted(() => {
  ventesStore.fetchVentes()
})

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
}

tbody tr:hover {
  background: #f8fafc;
}

tbody tr:last-child td {
  border-bottom: none;
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
</style>