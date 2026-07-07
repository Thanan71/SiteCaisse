<template>
  <div class="admin-container">
    <div class="admin-header">
      <h1>Administration</h1>
      <p class="admin-subtitle">Gestion des utilisateurs, commissions et logs</p>
    </div>

    <TabNav
      v-model="activePanel"
      :tabs="[
        { key: 'users', label: 'Utilisateurs' },
        { key: 'commissions', label: 'Commissions' },
        { key: 'logs', label: 'Logs' },
      ]"
    />

    <template v-if="activePanel === 'commissions'">
      <!-- Section Paramètres : Commissions CB -->
      <div class="card parametres-card">
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

      <!-- Section Commissions personnalisées -->
      <div class="card custom-commissions-card">
        <div class="section-header">
          <div>
            <h2>Commissions personnalisées</h2>
            <p class="section-description">
              Une commission personnalisée remplace le taux général uniquement pour l'artisan choisi.
            </p>
          </div>
          <button
            class="btn btn-primary"
            type="button"
            :disabled="availableCommissionUsers.length === 0"
            @click="openCreateCommissionModal"
          >
            Ajouter une commission personnalisée
          </button>
        </div>

        <div v-if="customCommissionUsers.length === 0" class="empty-state">
          Aucune commission personnalisée définie.
        </div>
        <div v-else class="custom-commissions-table-wrapper">
          <table class="custom-commissions-table">
            <thead>
              <tr>
                <th>Artisan</th>
                <th>Boutique</th>
                <th>Rôle</th>
                <th>Taux personnalisé</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in customCommissionUsers" :key="user.id">
                <td>{{ user.nom }}</td>
                <td>{{ user.nom_boutique }}</td>
                <td>{{ user.role === 'temporaire' ? 'Temporaire' : 'Permanent' }}</td>
                <td>
                  <span class="commission-rate">
                    {{ formatCommissionRate(user.commission_cb_personnalisee) }}
                  </span>
                </td>
                <td>
                  <div class="actions-cell">
                    <button
                      class="btn btn-secondary btn-sm"
                      type="button"
                      :disabled="savingCommissionId === user.id"
                      @click="openCommissionModal(user)"
                    >
                      Modifier
                    </button>
                    <button
                      class="btn btn-danger btn-sm"
                      type="button"
                      :disabled="savingCommissionId === user.id"
                      @click="clearCustomCommission(user)"
                    >
                      {{ savingCommissionId === user.id ? '...' : 'Supprimer' }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

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
              <label for="nom_boutique">Nom de la boutique</label>
              <input
                id="nom_boutique"
                v-model="newUser.nom_boutique"
                type="text"
                placeholder="Nom de la boutique"
                required
              />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="role">Rôle</label>
              <select id="role" v-model="newUser.role" required @change="onRoleChange">
                <option value="" disabled>Sélectionner un rôle</option>
                <option value="permanent">Permanent</option>
                <option value="temporaire">Temporaire</option>
              </select>
            </div>
            <div v-if="newUser.role === 'temporaire'" class="form-group">
              <label for="date_fin">Date de fin d'accès</label>
              <input
                id="date_fin"
                v-model="newUser.date_fin"
                type="date"
                required
                :min="minDate"
              />
            </div>
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
    <ConfirmModal
      :show="showDeleteModal"
      title="Confirmer la suppression"
      :message="`Êtes-vous sûr de vouloir supprimer **${userToDelete?.nom}** (${userToDelete?.nom_boutique}) ?`"
      warning="Cette action est irréversible. Les ventes historiques seront conservées, mais détachées de cet utilisateur."
      confirmText="Confirmer la suppression"
      variant="danger"
      :loading="deletingId !== null"
      loadingText="Suppression..."
      @confirm="confirmDeleteUser"
      @cancel="closeDeleteModal"
    />

    <!-- Modal de prolongation d'accès -->
    <div v-if="showExtendModal" class="custom-modal-overlay" @click.self="closeExtendModal">
      <div class="custom-modal-content">
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

    <!-- Modal de commission personnalisée -->
    <div v-if="showCommissionModal" class="custom-modal-overlay" @click.self="closeCommissionModal">
      <div class="custom-modal-content">
        <h3>
          {{
            commissionModalMode === 'create'
              ? 'Ajouter une commission personnalisée'
              : `Modifier la commission de ${userToEditCommission?.nom}`
          }}
        </h3>
        <div v-if="commissionModalMode === 'create'" class="form-group" style="margin: 16px 0;">
          <label for="commission-user">Artisan</label>
          <select id="commission-user" v-model="selectedCommissionUserId">
            <option value="" disabled>Sélectionner un artisan</option>
            <option v-for="user in availableCommissionUsers" :key="user.id" :value="user.id">
              {{ user.nom_boutique }} - {{ user.nom }}
            </option>
          </select>
        </div>
        <div class="form-group" style="margin: 16px 0;">
          <label for="user-commission-cb">Taux personnalisé (%)</label>
          <div class="input-with-suffix">
            <input
              id="user-commission-cb"
              v-model="commissionDraft"
              type="number"
              min="0"
              step="0.01"
              placeholder="Taux général"
            />
            <span class="input-suffix">%</span>
          </div>
        </div>
        <p v-if="commissionError" class="error-message">{{ commissionError }}</p>
        <div class="modal-actions">
          <button @click="closeCommissionModal" class="btn btn-secondary">Annuler</button>
          <button
            @click="confirmSaveCommission"
            class="btn btn-primary"
            :disabled="savingCommissionId !== null"
          >
            {{ savingCommissionId ? 'Enregistrement...' : 'Enregistrer' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal de confirmation de réinitialisation de mot de passe -->
    <ConfirmModal
      :show="showResetModal"
      title="Réinitialiser le mot de passe"
      :message="resetMessage"
      warning="Le nouveau mot de passe sera généré à partir du nom de la boutique, suivi de 4 chiffres aléatoires."
      confirmText="Réinitialiser"
      variant="warning"
      :loading="resettingId !== null"
      loadingText="Réinitialisation..."
      @confirm="confirmResetPassword"
      @cancel="closeResetModal"
    />

    <!-- Modal de résultat de mot de passe généré -->
    <div v-if="showResetResultModal" class="custom-modal-overlay" @click.self="closeResetResultModal">
      <div class="custom-modal-content">
        <h3>✅ {{ resetResultTitle }}</h3>
        <p>{{ resetResultMessage }}</p>
        <div v-if="resetResultPassword" class="password-result-box">
          <p style="margin-bottom: 6px;"><strong>Nouveau mot de passe :</strong></p>
          <div class="password-display">{{ resetResultPassword }}</div>
          <p class="password-hint">Copiez ce mot de passe et transmettez-le à l'utilisateur. Il est aussi affiché dans la liste des utilisateurs.</p>
        </div>
        <div class="modal-actions">
          <button @click="closeResetResultModal" class="btn btn-primary">Fermer</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import ConfirmModal from '../components/ConfirmModal.vue'
import LogsViewer from '../components/LogsViewer.vue'
import ParametresCommissions from '../components/ParametresCommissions.vue'
import TabNav from '../components/TabNav.vue'
import UserTable from '../components/UserTable.vue'
import { useCommissions } from '../composables/useCommissions'
import { useLogs } from '../composables/useLogs'
import { useUsers } from '../composables/useUsers'
import { formatDateSimple } from '../utils/formatters'

const activePanel = ref('users')

// Utilisateurs : toute la logique métier extraite dans le composable
const {
  users,
  loading,
  creating,
  createError,
  createSuccess,
  newUser,
  deletingId,
  showDeleteModal,
  userToDelete,
  showExtendModal,
  userToExtend,
  extendDateFin,
  extendError,
  extendingId,
  showResetModal,
  showResetResultModal,
  userToReset,
  resetResultTitle,
  resetMessage,
  resetResultMessage,
  resetResultPassword,
  resettingId,
  showCommissionModal,
  userToEditCommission,
  commissionModalMode,
  selectedCommissionUserId,
  commissionDraft,
  commissionError,
  savingCommissionId,
  fetchUsers,
  handleCreateUser,
  onRoleChange,
  openCreateCommissionModal,
  openCommissionModal,
  closeCommissionModal,
  confirmSaveCommission,
  clearCustomCommission,
  openDeleteModal,
  closeDeleteModal,
  confirmDeleteUser,
  openExtendModal,
  closeExtendModal,
  confirmExtendUser,
  openResetModal,
  closeResetModal,
  closeResetResultModal,
  confirmResetPassword,
  getStatusClass,
  getStatusLabel,
} = useUsers()

// Commissions CB : logique extraite dans useCommissions
const {
  commissionPermanent,
  commissionTemporaire,
  savingCommissions,
  commissionsError,
  commissionsSuccess,
  fetchParametres,
  handleSaveCommissions,
} = useCommissions()

// Logs : logique extraite dans useLogs
const {
  logs,
  logsLoading,
  logsError,
  logFilters,
  logsPagination,
  fetchLogs,
  applyLogFilters,
  changeLogsPage,
} = useLogs()

// Date minimum pour le champ date (aujourd'hui)
const minDate = computed(() => {
  const today = new Date()
  return today.toISOString().split('T')[0]
})

const artisanUsers = computed(() => users.value.filter((user) => user.role !== 'admin'))

function hasCustomCommission(user) {
  return user.commission_cb_personnalisee !== null && user.commission_cb_personnalisee !== undefined
}

function hasNoCustomCommission(user) {
  return !hasCustomCommission(user)
}

const customCommissionUsers = computed(() => artisanUsers.value.filter(hasCustomCommission))

const availableCommissionUsers = computed(() => artisanUsers.value.filter(hasNoCustomCommission))

function formatCommissionRate(value) {
  return `${Number(value).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}%`
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

.section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.section-header h2 {
  margin-bottom: 6px;
}

.section-description {
  color: #64748b;
  font-size: 0.85rem;
  margin: 0;
  line-height: 1.5;
}

.custom-commissions-table-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.custom-commissions-table {
  width: 100%;
  min-width: 720px;
  border-collapse: collapse;
  font-size: 0.86rem;
}

.custom-commissions-table th {
  text-align: left;
  padding: 10px;
  border-bottom: 2px solid #e2e8f0;
  color: #64748b;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  white-space: nowrap;
}

.custom-commissions-table td {
  padding: 10px;
  border-bottom: 1px solid #f1f5f9;
  color: #1e293b;
}

.commission-rate {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 6px;
  background: #dcfce7;
  color: #15803d;
  font-size: 0.78rem;
  font-weight: 700;
}

.actions-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
}

.btn-sm {
  padding: 6px 10px;
  font-size: 0.78rem;
  white-space: nowrap;
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

/* Custom modal (prolongation) */
.custom-modal-overlay {
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

.custom-modal-content {
  background: white;
  border-radius: 12px;
  padding: 28px;
  max-width: 460px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.custom-modal-content h3 {
  margin: 0 0 12px 0;
  font-size: 1.15rem;
  color: #1e293b;
}

.custom-modal-content p {
  margin: 0 0 8px 0;
  color: #475569;
  font-size: 0.9rem;
  line-height: 1.5;
}

.password-result-box {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  padding: 16px;
  margin: 12px 0;
}

.password-display {
  font-family: 'SF Mono', 'Fira Code', 'Courier New', monospace;
  font-size: 1.1rem;
  font-weight: 700;
  color: #16a34a;
  background: white;
  padding: 10px 14px;
  border-radius: 6px;
  border: 1px dashed #86efac;
  text-align: center;
  letter-spacing: 0.5px;
  user-select: all;
}

.password-hint {
  font-size: 0.8rem;
  color: #64748b;
  margin: 8px 0 0 0;
  font-style: italic;
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

  .section-header {
    flex-direction: column;
  }

  .admin-container {
    padding: 20px 16px;
  }

  .card {
    padding: 16px;
  }
}
</style>
