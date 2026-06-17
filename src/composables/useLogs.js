/**
 * @module composables/useLogs
 * @description Composable pour la gestion des logs d'actions.
 * Extrait la logique de fetch/pagination/filtres des logs depuis AdminView.
 */
import { ref } from 'vue'
import api from '../services/api'

export function useLogs() {
  const logs = ref([])
  const logsLoading = ref(false)
  const logsError = ref('')
  const logFilters = ref({ action: '', cible_type: '' })
  const logsPagination = ref({ page: 1, limit: 25, total: 0, totalPages: 0 })

  /**
   * Récupère le journal des actions depuis l'API admin.
   * @param {number} [page=logsPagination.value.page] - Numéro de page
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

  function applyLogFilters() {
    fetchLogs(1)
  }

  function changeLogsPage(page) {
    if (page < 1 || page > logsPagination.value.totalPages) return
    fetchLogs(page)
  }

  return {
    logs,
    logsLoading,
    logsError,
    logFilters,
    logsPagination,
    fetchLogs,
    applyLogFilters,
    changeLogsPage,
  }
}