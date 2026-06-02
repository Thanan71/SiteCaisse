<template>
  <div class="users-table-wrapper">
    <table class="users-table">
      <thead>
        <tr>
          <th class="col-id">ID</th>
          <th class="col-nom">Nom</th>
          <th class="col-email">Email</th>
          <th class="col-role">Rôle</th>
          <th class="col-actif">Actif</th>
          <th class="col-date-fin">Date de fin</th>
          <th class="col-date-crea">Création</th>
          <th class="col-actions">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="user in users" :key="user.id">
          <td class="col-id">{{ user.id }}</td>
          <td class="col-nom">{{ user.nom }}</td>
          <td class="col-email" :title="user.email">{{ user.email }}</td>
          <td class="col-role">
            <span class="role-badge" :class="'role-' + user.role">
              {{ user.role === 'admin' ? 'Admin' : user.role === 'permanent' ? 'Permanent' : 'Temporaire' }}
            </span>
          </td>
          <td class="col-actif">
            <span class="status-dot" :class="getStatusClass(user)"></span>
            {{ getStatusLabel(user) }}
          </td>
          <td class="col-date-fin">{{ user.date_fin ? formatDateSimple(user.date_fin) : '—' }}</td>
          <td class="col-date-crea" :title="formatDate(user.created_at)">{{ formatDate(user.created_at) }}</td>
          <td class="col-actions">
            <div class="actions-cell">
              <button
                v-if="user.role === 'temporaire'"
                @click="$emit('extend', user)"
                class="btn btn-success btn-sm"
                :disabled="extendingId === user.id"
              >
                {{ extendingId === user.id ? '...' : 'Prolonger' }}
              </button>
              <button
                v-if="user.role !== 'admin'"
                @click="$emit('delete', user)"
                class="btn btn-danger btn-sm"
                :disabled="deletingId === user.id"
                title="Supprimer"
              >
                {{ deletingId === user.id ? '...' : 'Suppr.' }}
              </button>
              <button
                @click="$emit('reset-password', user)"
                class="btn btn-warning btn-sm"
                :disabled="resettingId === user.id"
                title="Réinitialiser le mot de passe"
              >
                {{ resettingId === user.id ? '...' : 'MDP' }}
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { formatDateTime as formatDate, formatDateSimple } from '../utils/formatters'

const props = defineProps({
  users: { type: Array, required: true },
  deletingId: { type: Number, default: null },
  extendingId: { type: Number, default: null },
  resettingId: { type: Number, default: null },
  getStatusClass: { type: Function, required: true },
  getStatusLabel: { type: Function, required: true },
})

defineEmits(['delete', 'extend', 'reset-password'])
</script>

<style scoped>
.users-table-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.users-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
  min-width: 700px;
}

.users-table th {
  text-align: left;
  padding: 10px 10px;
  border-bottom: 2px solid #e2e8f0;
  color: #64748b;
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.users-table td {
  padding: 10px 10px;
  border-bottom: 1px solid #f1f5f9;
  color: #1e293b;
}

.users-table tbody tr:hover {
  background: #f8fafc;
}

/* Column widths for better fit */
.col-id {
  width: 50px;
  text-align: center;
}
.col-email {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.col-role {
  white-space: nowrap;
}
.col-actif {
  white-space: nowrap;
}
.col-date-fin {
  white-space: nowrap;
}
.col-date-crea {
  white-space: nowrap;
  font-size: 0.8rem;
}
.col-actions {
  white-space: nowrap;
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

.actions-cell {
  display: flex;
  gap: 4px;
  align-items: center;
  flex-wrap: nowrap;
}

.btn-sm {
  padding: 5px 8px;
  font-size: 0.75rem;
  white-space: nowrap;
}
</style>