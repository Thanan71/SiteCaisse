<template>
  <div class="admin-container">
    <div class="admin-header">
      <h1>Administration</h1>
      <p class="admin-subtitle">Gestion des utilisateurs, commissions et logs</p>
    </div>

    <nav class="admin-subnav" aria-label="Sections administration">
      <button
        type="button"
        class="subnav-button"
        :class="{ active: activePanel === 'users' }"
        @click="activePanel = 'users'"
      >
        Utilisateurs
      </button>
      <button
        type="button"
        class="subnav-button"
        :class="{ active: activePanel === 'commissions' }"
        @click="activePanel = 'commissions'"
      >
        Commissions
      </button>
      <button
        type="button"
        class="subnav-button"
        :class="{ active: activePanel === 'logs' }"
        @click="activePanel = 'logs'"
      >
        Logs
      </button>
    </nav>

    <!-- Section Paramètres : Commissions CB -->
    <div v-if="activePanel === 'commissions'" class="card parametres-card">
      <parametres-commissions
        :commission-permanent="commissionPermanent"
        :commission-temporaire="commissionTemporaire"
        :saving="savingCommissions"
        :error="commissionsError"
        :success="commissionsSuccess"
        @save="handleSaveCommissions"
        @update:commission-permanent="commissionPermanent = $event"
        @update:commission-temporaire="commissionTemporaire = $event"
      />
    </div>

    <template v-if="activePanel === 'users'">
      <!-- Section Ajouter un utilisateur -->
      <div class="card add-user-card">
        <h2>Ajouter un utilisateur</h2>
        <form @submit.prevent="handleCreateUser" class="add-user-form">
          <div class="form-row">
            <div class="form-group">
              <label for="nom">Nom</label>
              <input
                id="nom"
                v-model="newUser.nom"
                type="text"
                placeholder="Nom de l'utilisateur"
                required
              />
            </div>
            <div class="form-group">
              <label for="email">Email</label>
              <input
                id="email"
                v-model="newUser.email"
                type="email"
                placeholder="Email de l'utilisateur"
                required
              />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="password">Mot de passe</label>
              <input
                id="password"
                v-model="newUser.password"
                type="password"
                placeholder="Mot de passe"
                required
                minlength="4"
              />
            </div>
            <div class="form-group">
              <label for="role">Rôle</label>
              <select id="role" v-model="newUser.role" required @change="onRoleChange">
                <option value="" disabled>Sélectionner un rôle</option>
                <option value="permanent">Permanent</option>
                <option value="temporaire">Temporaire</option>
              </select>
            </div>
          </div>
          <div class="form-row" v-if="newUser.role === 'temporaire'">
            <div class="form-group">
              <label for="date_fin">Date de fin d'accès</label>
              <input
                id="date_fin"
                v-model="newUser.date_fin"
                type="date"
                required
                :min="minDate"
              />
            </div>
            <div class="form-group"></div>
          </div>
          <button type="submit" class="btn btn-primary" :disabled="creating">
            {{ creating ? 'Création...' : "Ajouter l'utilisateur" }}
          </button>
          <p v-if="createError" class="error-message">{{ createError }}</p>
          <p v-if="createSuccess" class="success-message">{{ createSuccess }}</p>
        </form>
      </div>

      <!-- Liste des utilisateurs -->
      <div class="card users-list-card">
        <h2>Utilisateurs ({{ users.length }})</h2>
        <div v-if="loading" class="loading">Chargement des utilisateurs...</div>
        <div v-else-if="users.length === 0" class="empty-state">
          Aucun utilisateur trouvé.
        </div>
        <UserTable
          v-else
          :users="users"
          :deleting-id="deletingId"
          :extending-id="extendingId"
          :resetting-id="resettingId"
          :get-status-class="getStatusClass"
          :get-status-label="getStatusLabel"
          @delete="openDeleteModal"
          @extend="openExtendModal"
          @reset-password="openResetModal"
        />
      </div>
    </template>

    <!-- Journal des actions -->
    <div v-if="activePanel === 'logs'" class="card logs-card">
      <logs-viewer
        :logs="logs"
        :logs-loading="logsLoading"
        :logs-error="logsError"
        :log-filters="logFilters"
        :logs-pagination="logsPagination"
        @fetch="fetchLogs"
        @apply-filters="applyLogFilters"
        @change-page="changeLogsPage"
        @update:log-filters="logFilters = $event"
      />
    </div>

    <!-- Modal de confirmation de suppression -->
    <div v-if="showDeleteModal" class="modal-overlay" @click.self="closeDeleteModal">
      <div class="modal-content">
        <h3>Confirmer la suppression</h3>
        <p>
          Êtes-vous sûr de vouloir supprimer <strong>{{ userToDelete?.nom }}</strong>
          ({{ userToDelete?.email }}) ?
        </p>
        <p class="warning-text">
          Cette action est irréversible. Les ventes liées à cet utilisateur seront également supprimées.
        </p>
        <div class="modal-actions">
          <button @click="closeDeleteModal" class="btn btn-secondary">Annuler</button>
          <button @click="confirmDeleteUser" class="btn btn-danger" :disabled="deletingId !== null">
            {{ deletingId ? 'Suppression...' : 'Confirmer la suppression' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal de prolongation d'accès -->
    <div v-if="showExtendModal" class="modal-overlay" @click.self="closeExtendModal">
      <div class="modal-content">
        <h3>Prolonger l'accès de {{ userToExtend?.nom }}</h3>
        <p>
          Date de fin actuelle : <strong>{{ userToExtend?.date_fin ? formatDateSimple(userToExtend.date_fin) : '—' }}</strong>
        </p>
        <div class="form-group" style="margin: 16px 0;">
          <label for="new-date-fin">Nouvelle date de fin</label>
          <input
            id="new-date-fin"
            v-model="extendDateFin"
            type="date"
            required
            :min="minDate"
          />
        </div>
        <p v-if="extendError" class="error-message">{{ extendError }}</p>
        <div class="modal-actions">
          <button @click="closeExtendModal" class="btn btn-secondary">Annuler</button>
          <button @click="confirmExtendUser" class="btn btn-success" :disabled="!extendDateFin || extendingId !== null">
            {{ extendingId ? 'Prolongement...' : 'Prolonger' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal de confirmation de réinitialisation de mot de passe -->
    <ConfirmModal
      :show="showResetModal"
      title="Réinitialiser le mot de passe"
      :message="resetMessage"
      warning="Un nouveau mot de passe sera généré et envoyé par email. L'utilisateur devra changer son mot de passe à la prochaine connexion."
      confirmText="Réinitialiser"
      variant="warning"
      :loading="resettingId !== null"
      loadingText="Envoi en cours..."
      @confirm="confirmResetPassword"
      @cancel="closeResetModal"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import api from '../services/api'
import ConfirmModal from '../components/ConfirmModal.vue'
import UserTable from '../components/UserTable.vue'
import ParametresCommissions from '../components/ParametresCommissions.vue'
import LogsViewer from '../components/LogsViewer.vue'
import { formatDateTime as formatDate, formatDateSimple } from '../utils/formatters'
import { useUsers } from '../composables/useUsers'

const activePanel = ref('users')

// Utilisateurs : toute la logique métier extraite dans le composable
const {
  users, loading, creating, createError, createSuccess, newUser,
  deletingId, showDeleteModal, userToDelete,
  showExtendModal, userToExtend, extendDateFin, extendError, extendingId,
  showResetModal, userToReset, resetMessage, resettingId,
  fetchUsers, handleCreateUser, onRoleChange,
  openDeleteModal, closeDeleteModal, confirmDeleteUser,
  openExtendModal, closeExtendModal, confirmExtendUser,
  openResetModal, closeResetModal, confirmResetPassword,
  getStatusClass, getStatusLabel,
} = useUsers()

// État des commissions CB
const commissionPermanent = ref('')
const commissionTemporaire = ref('')
const savingCommissions = ref(false)
const commissionsError = ref('')
const commissionsSuccess = ref('')

// État du journal des actions
const logs = ref([])
const logsLoading = ref(false)
const logsError = ref('')
const logFilters = ref({ action: '', cible_type: '' })
const logsPagination = ref({ page: 1, limit: 25, total: 0, totalPages: 0 })

// Date minimum pour le champ date (aujourd'hui)
const minDate = computed(() => {
  const today = new Date()
  return today.toISOString().split('T')[0]
})

/**
 * Charge les paramètres de commissions CB depuis l'API.
 */
async function fetchParametres() {
  try {
    const response = await api.get('/api/admin/parametres')
    const params = response.data
    commissionPermanent.value = params.commission_cb_permanent || ''
    commissionTemporaire.value = params.commission_cb_temporaire || ''
  } catch (err) {
    console.error('Erreur chargement paramètres:', err)
  }
}

/**
 * Enregistre les taux de commission CB.
 */
async function handleSaveCommissions() {
  savingCommissions.value = true
  commissionsError.value = ''
  commissionsSuccess.value = ''

  try {
    await api.put('/api/admin/parametres/commission_cb_permanent', {
      valeur: commissionPermanent.value,
    })
    await api.put('/api/admin/parametres/commission_cb_temporaire', {
      valeur: commissionTemporaire.value,
    })
    commissionsSuccess.value = 'Commissions CB mises à jour avec succès !'
    setTimeout(() => { commissionsSuccess.value = '' }, 3000)
  } catch (err) {
    commissionsError.value = err.response?.data?.error || "Erreur lors de l'enregistrement"
  } finally {
    savingCommissions.value = false
  }
}

/**
 * Récupère le journal des actions depuis l'API admin.
 */
async function fetchLogs(page = logsPagination.value.page) {
  try {
    logsLoading.value = true
    logsError.value = ''

    const params = { page, limit: logsPagination.value.limit }
    if (logFilters.value.action) params.action = logFilters.value.action
    if (logFilters.value.cible_type) params.cible_type = logFilters.value.cible_type

    const response = await api.get('/api/admin/logs', { params })
    logs.value = response.data.logs
    logsPagination.value = response.data.pagination
  } catch (err) {
    logsError.value = err.response?.data?.error || 'Erreur lors du chargement des logs'
  } finally {
    logsLoading.value = false
  }
}

function applyLogFilters() { fetchLogs(1) }

function changeLogsPage(page) {
  if (page < 1 || page > logsPagination.value.totalPages) return
  fetchLogs(page)
}

onMounted(() => {
  fetchUsers()
  fetchParametres()
  fetchLogs()
})
</script>

<style scoped>
.admin-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 24px;
}

.admin-header {
  margin-bottom: 32px;
}

.admin-header h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.admin-subtitle {
  color: #64748b;
  margin: 4px 0 0 0;
  font-size: 0.95rem;
}

.admin-subnav {
  display: flex;
  gap: 8px;
  padding: 6px;
  margin-bottom: 24px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow-x: auto;
}

.subnav-button {
  flex: 0 0 auto;
  padding: 9px 14px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #475569;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.subnav-button:hover {
  background: #e2e8f0;
  color: #1e293b;
}

.subnav-button.active {
  background: white;
  color: #4f46e5;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}

/* Cards */
.card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  border: 1px solid #e2e8f0;
}

.card h2 {
  font-size: 1.15rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 20px 0;
}

.parametres-info {
  color: #64748b;
  font-size: 0.85rem;
  margin: -12px 0 16px 0;
  line-height: 1.5;
}

.parametres-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.input-with-suffix {
  position: relative;
  display: flex;
  align-items: center;
}

.input-with-suffix input {
  width: 100%;
  padding: 10px 36px 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.9rem;
  color: #1e293b;
  background: white;
  transition: border-color 0.2s;
}

.input-with-suffix input:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

.input-suffix {
  position: absolute;
  right: 12px;
  color: #64748b;
  font-weight: 500;
  pointer-events: none;
}

/* Form */
.add-user-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 0.85rem;
  font-weight: 500;
  color: #475569;
}

.form-group input,
.form-group select {
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.9rem;
  color: #1e293b;
  background: white;
  transition: border-color 0.2s;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

/* Buttons */
.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #4f46e5;
  color: white;
  align-self: flex-start;
}

.btn-primary:hover:not(:disabled) {
  background: #4338ca;
}

.btn-secondary {
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
}

.btn-secondary:hover:not(:disabled) {
  background: #e2e8f0;
}

.btn-success {
  background: #22c55e;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #16a34a;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #dc2626;
}

.btn-warning {
  background: #f59e0b;
  color: white;
}

.btn-warning:hover:not(:disabled) {
  background: #d97706;
}

/* Messages */
.error-message {
  color: #ef4444;
  font-size: 0.85rem;
  margin: 0;
}

.success-message {
  color: #22c55e;
  font-size: 0.85rem;
  margin: 0;
}

/* Loading & Empty */
.loading {
  text-align: center;
  color: #64748b;
  padding: 40px 0;
}

.empty-state {
  text-align: center;
  color: #94a3b8;
  padding: 40px 0;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  padding: 28px;
  max-width: 460px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-content h3 {
  margin: 0 0 12px 0;
  font-size: 1.15rem;
  color: #1e293b;
}

.modal-content p {
  margin: 0 0 8px 0;
  color: #475569;
  font-size: 0.9rem;
  line-height: 1.5;
}

.warning-text {
  color: #ef4444 !important;
  font-size: 0.85rem !important;
  background: #fef2f2;
  padding: 10px 12px;
  border-radius: 8px;
  margin-bottom: 20px !important;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 8px;
}

/* Responsive */
@media (max-width: 640px) {
  .form-row {
    grid-template-columns: 1fr;
  }

  .admin-container {
    padding: 20px 16px;
  }

  .card {
    padding: 16px;
  }
}
</style>