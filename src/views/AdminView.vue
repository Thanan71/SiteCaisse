<template>
  <div class="admin-container">
    <div class="admin-header">
      <h1>Administration</h1>
      <p class="admin-subtitle">Gestion des utilisateurs et paramètres</p>
    </div>

    <!-- Section Paramètres : Commissions CB -->
    <div class="card parametres-card">
      <h2>Paramètres des commissions CB</h2>
      <p class="parametres-info">
        Les commissions CB sont calculées en pourcentage du montant total des ventes par carte bancaire.
      </p>
      <form @submit.prevent="handleSaveCommissions" class="parametres-form">
        <div class="form-row">
          <div class="form-group">
            <label for="commission-permanent">Commission CB - Artisans permanents (%)</label>
            <div class="input-with-suffix">
              <input
                id="commission-permanent"
                v-model="commissionPermanent"
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="1.70"
                required
              />
              <span class="input-suffix">%</span>
            </div>
          </div>
          <div class="form-group">
            <label for="commission-temporaire">Commission CB - Artisans temporaires (%)</label>
            <div class="input-with-suffix">
              <input
                id="commission-temporaire"
                v-model="commissionTemporaire"
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="1.70"
                required
              />
              <span class="input-suffix">%</span>
            </div>
          </div>
        </div>
        <button type="submit" class="btn btn-primary" :disabled="savingCommissions">
          {{ savingCommissions ? 'Enregistrement...' : 'Enregistrer les commissions' }}
        </button>
        <p v-if="commissionsError" class="error-message">{{ commissionsError }}</p>
        <p v-if="commissionsSuccess" class="success-message">{{ commissionsSuccess }}</p>
      </form>
    </div>

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

      <div v-else class="users-table-wrapper">
        <table class="users-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nom</th>
              <th>Email</th>
              <th>Rôle</th>
              <th>Actif</th>
              <th>Date de fin</th>
              <th>Date de création</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id">
              <td>{{ user.id }}</td>
              <td>{{ user.nom }}</td>
              <td>{{ user.email }}</td>
              <td>
                <span class="role-badge" :class="'role-' + user.role">
                  {{ user.role === 'admin' ? 'Admin' : user.role === 'permanent' ? 'Permanent' : 'Temporaire' }}
                </span>
              </td>
              <td>
                <span class="status-dot" :class="getStatusClass(user)"></span>
                {{ getStatusLabel(user) }}
              </td>
              <td>{{ user.date_fin ? formatDateSimple(user.date_fin) : '—' }}</td>
              <td>{{ formatDate(user.created_at) }}</td>
              <td>
                <button
                  v-if="user.role !== 'admin'"
                  @click="handleDeleteUser(user)"
                  class="btn btn-danger btn-sm"
                  :disabled="deletingId === user.id"
                >
                  {{ deletingId === user.id ? 'Suppression...' : 'Supprimer' }}
                </button>
                <span v-else class="text-muted">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
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
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '../services/api'

// État du formulaire d'ajout
const newUser = ref({
  nom: '',
  email: '',
  password: '',
  role: '',
  date_fin: ''
})
const creating = ref(false)
const createError = ref('')
const createSuccess = ref('')

// État de la liste
const users = ref([])
const loading = ref(true)

// État de la suppression
const showDeleteModal = ref(false)
const userToDelete = ref(null)
const deletingId = ref(null)

// État des commissions CB
const commissionPermanent = ref('')
const commissionTemporaire = ref('')
const savingCommissions = ref(false)
const commissionsError = ref('')
const commissionsSuccess = ref('')

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
    await api.put(`/api/admin/parametres/commission_cb_permanent`, {
      valeur: commissionPermanent.value
    })
    await api.put(`/api/admin/parametres/commission_cb_temporaire`, {
      valeur: commissionTemporaire.value
    })
    commissionsSuccess.value = 'Commissions CB mises à jour avec succès !'
    setTimeout(() => { commissionsSuccess.value = '' }, 3000)
  } catch (err) {
    commissionsError.value = err.response?.data?.error || 'Erreur lors de l\'enregistrement'
  } finally {
    savingCommissions.value = false
  }
}

/**
 * Réinitialise la date de fin quand on change de rôle.
 */
function onRoleChange() {
  if (newUser.value.role === 'permanent') {
    newUser.value.date_fin = ''
  }
}

/**
 * Récupère la liste des utilisateurs depuis l'API.
 * @returns {Promise<void>}
 */
async function fetchUsers() {
  try {
    loading.value = true
    const response = await api.get('/api/admin/users')
    users.value = response.data
  } catch (err) {
    console.error('Erreur chargement utilisateurs:', err)
  } finally {
    loading.value = false
  }
}

/**
 * Crée un nouvel utilisateur.
 * @returns {Promise<void>}
 */
async function handleCreateUser() {
  creating.value = true
  createError.value = ''
  createSuccess.value = ''

  try {
    const payload = {
      nom: newUser.value.nom,
      email: newUser.value.email,
      password: newUser.value.password,
      role: newUser.value.role
    }

    // Ajouter date_fin uniquement si c'est un temporaire
    if (newUser.value.role === 'temporaire' && newUser.value.date_fin) {
      payload.date_fin = newUser.value.date_fin
    }

    await api.post('/api/admin/users', payload)

    createSuccess.value = `Utilisateur ${newUser.value.nom} créé avec succès !`
    newUser.value = { nom: '', email: '', password: '', role: '', date_fin: '' }
    await fetchUsers()

    // Effacer le message de succès après 3 secondes
    setTimeout(() => { createSuccess.value = '' }, 3000)
  } catch (err) {
    createError.value = err.response?.data?.error || 'Erreur lors de la création'
  } finally {
    creating.value = false
  }
}

/**
 * Ouvre la modale de confirmation de suppression.
 * @param {Object} user - Utilisateur à supprimer.
 */
function handleDeleteUser(user) {
  userToDelete.value = user
  showDeleteModal.value = true
}

/**
 * Ferme la modale de suppression.
 */
function closeDeleteModal() {
  showDeleteModal.value = false
  userToDelete.value = null
}

/**
 * Confirme et exécute la suppression d'un utilisateur.
 * @returns {Promise<void>}
 */
async function confirmDeleteUser() {
  if (!userToDelete.value) return

  deletingId.value = userToDelete.value.id

  try {
    await api.delete(`/api/admin/users/${userToDelete.value.id}`)
    closeDeleteModal()
    await fetchUsers()
  } catch (err) {
    console.error('Erreur suppression:', err)
    alert(err.response?.data?.error || 'Erreur lors de la suppression')
  } finally {
    deletingId.value = null
  }
}

/**
 * Retourne la classe CSS pour le statut actif/expiré.
 * @param {Object} user
 * @returns {string}
 */
function getStatusClass(user) {
  if (!user.est_actif) return 'inactive'
  if (isDateFinExpired(user.date_fin)) return 'expired'
  return 'active'
}

/**
 * Retourne le label pour le statut.
 * @param {Object} user
 * @returns {string}
 */
function getStatusLabel(user) {
  if (!user.est_actif) return 'Non'
  if (isDateFinExpired(user.date_fin)) return 'Expiré'
  return 'Oui'
}

/**
 * Vérifie si la date de fin est dépassée.
 * @param {string|null} dateFin
 * @returns {boolean}
 */
function isDateFinExpired(dateFin) {
  if (!dateFin) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const fin = new Date(dateFin + 'T00:00:00')
  return fin < today
}

/**
 * Formate une date ISO en format lisible.
 * @param {string} dateStr - Date au format ISO.
 * @returns {string} Date formatée (jj/mm/aaaa).
 */
function formatDate(dateStr) {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Formate une date simple (AAAA-MM-JJ) en format lisible.
 * @param {string} dateStr - Date au format AAAA-MM-JJ.
 * @returns {string} Date formatée (jj/mm/aaaa).
 */
function formatDateSimple(dateStr) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

onMounted(() => {
  fetchUsers()
  fetchParametres()
})
</script>

<style scoped>
.admin-container {
  max-width: 1000px;
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

/* Paramètres card */
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

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #dc2626;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 0.8rem;
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

/* Table */
.users-table-wrapper {
  overflow-x: auto;
}

.users-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.users-table th {
  text-align: left;
  padding: 12px 16px;
  border-bottom: 2px solid #e2e8f0;
  color: #64748b;
  font-weight: 600;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.users-table td {
  padding: 12px 16px;
  border-bottom: 1px solid #f1f5f9;
  color: #1e293b;
}

.users-table tbody tr:hover {
  background: #f8fafc;
}

/* Role badge */
.role-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 0.78rem;
  font-weight: 500;
}

.role-admin {
  background: #f3e8ff;
  color: #9333ea;
}

.role-permanent {
  background: #dbeafe;
  color: #2563eb;
}

.role-temporaire {
  background: #fef3c7;
  color: #d97706;
}

/* Status dot */
.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
}

.status-dot.active {
  background: #22c55e;
}

.status-dot.inactive {
  background: #ef4444;
}

.status-dot.expired {
  background: #f97316;
}

.text-muted {
  color: #94a3b8;
  font-size: 0.85rem;
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