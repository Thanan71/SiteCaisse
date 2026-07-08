<template>
  <div>
    <div class="section-title-row">
      <div>
        <h2>Journal des actions</h2>
        <p class="section-subtitle">{{ logsPagination.total }} action{{ logsPagination.total > 1 ? 's' : '' }} enregistrée{{ logsPagination.total > 1 ? 's' : '' }}</p>
      </div>
      <button @click="$emit('fetch')" class="btn btn-secondary btn-sm" :disabled="logsLoading">
        {{ logsLoading ? 'Actualisation...' : 'Actualiser' }}
      </button>
    </div>

    <div class="logs-filters">
      <div class="form-group">
        <label for="log-action">Action</label>
        <select id="log-action" :value="logFilters.action" @change="$emit('update:log-filters', { ...logFilters, action: $event.target.value })">
          <option value="">Toutes</option>
          <option value="error">Erreur</option>
          <option value="auth.login_success">Connexion réussie</option>
          <option value="auth.login_failed">Connexion échouée</option>
          <option value="auth.token_refused">Session refusée</option>
          <option value="vente.create">Vente créée</option>
          <option value="vente.update">Vente modifiée</option>
          <option value="vente.delete">Vente supprimée</option>
          <option value="user.create">Utilisateur créé</option>
          <option value="user.deactivate">Utilisateur archivé</option>
          <option value="user.reactivate">Utilisateur désarchivé</option>
          <option value="user.delete">Utilisateur supprimé</option>
          <option value="user.extend">Accès prolongé</option>
          <option value="parametre.update">Paramètre modifié</option>
        </select>
      </div>
      <div class="form-group">
        <label for="log-cible">Cible</label>
        <select id="log-cible" :value="logFilters.cible_type" @change="$emit('update:log-filters', { ...logFilters, cible_type: $event.target.value })">
          <option value="">Toutes</option>
          <option value="auth">Authentification</option>
          <option value="vente">Vente</option>
          <option value="user">Utilisateur</option>
          <option value="parametre">Paramètre</option>
          <option value="rapport">Rapport</option>
          <option value="log">Log</option>
        </select>
      </div>
    </div>

    <p v-if="logsError" class="error-message">{{ logsError }}</p>
    <div v-if="logsLoading" class="loading">Chargement des logs...</div>
    <div v-else-if="logs.length === 0" class="empty-state">
      Aucun log trouvé.
    </div>
    <div v-else class="logs-table-wrapper">
      <table class="logs-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Utilisateur</th>
            <th>Action</th>
            <th>Cible</th>
            <th>Détails</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in logs" :key="log.id">
            <td>{{ formatDate(log.created_at) }}</td>
            <td>
              <span>{{ log.user_nom || 'Système' }}</span>
              <span v-if="log.user_nom_boutique" class="log-shop">{{ log.user_nom_boutique }}</span>
            </td>
            <td>
              <span class="action-badge" :class="{ 'action-error': log.action === 'error' }">{{ getActionLabel(log.action) }}</span>
            </td>
            <td>{{ getCibleLabel(log.cible_type) }}{{ log.cible_id ? ` #${log.cible_id}` : '' }}</td>
            <td class="log-details">{{ formatLogDetails(log.details) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="logsPagination.totalPages > 1" class="pagination-controls">
      <button class="btn btn-secondary btn-sm" @click="$emit('change-page', logsPagination.page - 1)" :disabled="logsPagination.page <= 1 || logsLoading">
        Précédent
      </button>
      <span class="pagination-label">Page {{ logsPagination.page }} / {{ logsPagination.totalPages }}</span>
      <button class="btn btn-secondary btn-sm" @click="$emit('change-page', logsPagination.page + 1)" :disabled="logsPagination.page >= logsPagination.totalPages || logsLoading">
        Suivant
      </button>
    </div>
  </div>
</template>

<script setup>
import { formatDateTime as formatDate } from '../utils/formatters'

defineProps({
  logs: { type: Array, required: true },
  logsLoading: { type: Boolean, default: false },
  logsError: { type: String, default: '' },
  logFilters: { type: Object, required: true },
  logsPagination: { type: Object, required: true },
})

defineEmits(['fetch', 'change-page', 'update:log-filters'])

const LABELS_ACTION = {
  error: 'Erreur',
  'auth.login_success': 'Connexion réussie',
  'auth.login_failed': 'Connexion échouée',
  'auth.token_refused': 'Session refusée',
  'vente.create': 'Vente créée',
  'vente.update': 'Vente modifiée',
  'vente.delete': 'Vente supprimée',
  'user.create': 'Utilisateur créé',
  'user.deactivate': 'Utilisateur archivé',
  'user.reactivate': 'Utilisateur désarchivé',
  'user.delete': 'Utilisateur supprimé',
  'user.extend': 'Accès prolongé',
  'parametre.update': 'Paramètre modifié',
}

const LABELS_CIBLE = {
  auth: 'Authentification',
  vente: 'Vente',
  user: 'Utilisateur',
  parametre: 'Paramètre',
  rapport: 'Rapport',
  log: 'Log',
  error: 'Erreur',
}

function getActionLabel(action) {
  return LABELS_ACTION[action] || action
}

function getCibleLabel(cibleType) {
  return LABELS_CIBLE[cibleType] || cibleType || '—'
}

function formatLogDetails(details) {
  if (!details) return '—'
  let data = details

  if (typeof details === 'string') {
    try {
      data = JSON.parse(details)
    } catch {
      return details
    }
  }

  if (Object.keys(data).length === 0) return '—'

  if (data.context && data.message) return `${data.context} : ${data.message}`
  if (data.reason) return `Raison : ${data.reason}`
  if (data.cle) return `${data.cle} = ${data.valeur}`
  if (data.nom && data.nom_boutique) return `${data.nom} (${data.nom_boutique})`
  if (data.type_paiement && data.artisan_id) {
    const nbArticles = Array.isArray(data.articles) ? data.articles.length : 0
    return `${data.type_paiement}, artisan #${data.artisan_id}, ${nbArticles} article${nbArticles > 1 ? 's' : ''}`
  }
  if (data.modifications) return 'Modification vente'
  if (data.nom_boutique) return data.nom_boutique

  return JSON.stringify(data)
}
</script>

<style scoped>
.section-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.section-title-row h2 {
  margin: 0 0 4px 0;
  font-size: 1.15rem;
  font-weight: 600;
  color: #1e293b;
}

.section-subtitle {
  color: #64748b;
  font-size: 0.85rem;
  margin: 0;
}

.logs-filters {
  display: grid;
  grid-template-columns: minmax(180px, 240px) minmax(180px, 240px);
  gap: 16px;
  margin-bottom: 16px;
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

.form-group select {
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.9rem;
  color: #1e293b;
  background: white;
  transition: border-color 0.2s;
}

.form-group select:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

.logs-table-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.logs-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.logs-table th {
  text-align: left;
  padding: 12px 16px;
  border-bottom: 2px solid #e2e8f0;
  color: #64748b;
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.logs-table td {
  padding: 12px 16px;
  border-bottom: 1px solid #f1f5f9;
  color: #1e293b;
  vertical-align: top;
}

.logs-table tbody tr:hover {
  background: #f8fafc;
}

.log-shop {
  display: block;
  color: #64748b;
  font-size: 0.78rem;
  margin-top: 2px;
}

.action-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 0.78rem;
  font-weight: 500;
  color: #0f766e;
  background: #ccfbf1;
  white-space: nowrap;
}

.action-badge.action-error {
  color: #b91c1c;
  background: #fee2e2;
}

.log-details {
  max-width: 260px;
  color: #475569 !important;
  font-size: 0.82rem;
  line-height: 1.4;
}

.error-message {
  color: #ef4444;
  font-size: 0.85rem;
  margin: 0 0 12px 0;
}

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

.btn-secondary {
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
}

.btn-secondary:hover:not(:disabled) {
  background: #e2e8f0;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 0.8rem;
}

.pagination-controls {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}

.pagination-label {
  color: #64748b;
  font-size: 0.85rem;
}

@media (max-width: 640px) {
  .logs-filters {
    grid-template-columns: 1fr;
  }

  .section-title-row {
    flex-direction: column;
  }
}
</style>
