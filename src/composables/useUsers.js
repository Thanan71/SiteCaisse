/**
 * @module useUsers
 * @description Composable encapsulant toute la logique métier de gestion des utilisateurs
 * (liste, création, suppression, prolongation, réinitialisation de mot de passe).
 * Respecte le principe de responsabilité unique en isolant les appels API
 * et l'état des utilisateurs du rendu Vue.
 */
import { ref } from 'vue'
import api from '../services/api'

/**
 * @returns {Object} État et méthodes pour la gestion des utilisateurs
 */
export function useUsers() {
  /** @type {import('vue').Ref<Array>} */
  const users = ref([])
  const loading = ref(true)

  // Création
  const creating = ref(false)
  const createError = ref('')
  const createSuccess = ref('')
  const newUser = ref({
    nom: '',
    nom_boutique: '',
    password: '',
    role: '',
    date_fin: '',
  })

  // Suppression
  const showDeleteModal = ref(false)
  const userToDelete = ref(null)
  const deletingId = ref(null)

  // Prolongation
  const showExtendModal = ref(false)
  const userToExtend = ref(null)
  const extendDateFin = ref('')
  const extendError = ref('')
  const extendingId = ref(null)

  // Réinitialisation mot de passe
  const showResetModal = ref(false)
  const showResetResultModal = ref(false)
  const userToReset = ref(null)
  const resetMessage = ref('')
  const resetResultMessage = ref('')
  const resetResultPassword = ref('')
  const resettingId = ref(null)

  /**
   * Récupère la liste des utilisateurs depuis l'API.
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
   */
  async function handleCreateUser() {
    creating.value = true
    createError.value = ''
    createSuccess.value = ''

    try {
      const payload = { ...newUser.value }
      if (payload.role !== 'temporaire') {
        delete payload.date_fin
      }

      await api.post('/api/admin/users', payload)

      createSuccess.value = `Utilisateur ${newUser.value.nom} créé avec succès !`
      newUser.value = { nom: '', nom_boutique: '', password: '', role: '', date_fin: '' }
      await fetchUsers()

      setTimeout(() => {
        createSuccess.value = ''
      }, 3000)
    } catch (err) {
      createError.value = err.response?.data?.error || 'Erreur lors de la création'
    } finally {
      creating.value = false
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

  // ---- Suppression ----

  /**
   * Ouvre la modale de confirmation de suppression.
   * @param {Object} user
   */
  function openDeleteModal(user) {
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

  // ---- Prolongation ----

  /**
   * Ouvre la modale de prolongation d'accès.
   * @param {Object} user
   */
  function openExtendModal(user) {
    userToExtend.value = user
    extendDateFin.value = ''
    extendError.value = ''
    showExtendModal.value = true
  }

  /**
   * Ferme la modale de prolongation.
   */
  function closeExtendModal() {
    showExtendModal.value = false
    userToExtend.value = null
    extendDateFin.value = ''
    extendError.value = ''
  }

  /**
   * Confirme et exécute la prolongation d'accès.
   */
  async function confirmExtendUser() {
    if (!userToExtend.value || !extendDateFin.value) return

    extendingId.value = userToExtend.value.id
    extendError.value = ''

    try {
      await api.patch(`/api/admin/users/${userToExtend.value.id}/extend`, {
        date_fin: extendDateFin.value,
      })
      closeExtendModal()
      await fetchUsers()
    } catch (err) {
      extendError.value = err.response?.data?.error || 'Erreur lors de la prolongation'
    } finally {
      extendingId.value = null
    }
  }

  // ---- Réinitialisation mot de passe ----

  /**
   * Ouvre la modale de confirmation de réinitialisation.
   * @param {Object} user
   */
  function openResetModal(user) {
    userToReset.value = user
    resetMessage.value = `Confirmer la réinitialisation du mot de passe pour ${user.nom} (${user.nom_boutique}) ?`
    showResetModal.value = true
  }

  /**
   * Ferme la modale de réinitialisation.
   */
  function closeResetModal() {
    showResetModal.value = false
    userToReset.value = null
  }

  /**
   * Ferme la modale de résultat de réinitialisation.
   */
  function closeResetResultModal() {
    showResetResultModal.value = false
    resetResultMessage.value = ''
    resetResultPassword.value = ''
  }

  /**
   * Confirme et exécute la réinitialisation du mot de passe.
   */
  async function confirmResetPassword() {
    if (!userToReset.value) return

    resettingId.value = userToReset.value.id

    try {
      const response = await api.post(`/api/admin/users/${userToReset.value.id}/reset-password`)
      closeResetModal()
      resetResultMessage.value = response.data.message || 'Mot de passe réinitialisé avec succès.'
      resetResultPassword.value = response.data.newPassword || ''
      showResetResultModal.value = true
    } catch (err) {
      closeResetModal()
      alert(err.response?.data?.error || 'Erreur lors de la réinitialisation du mot de passe')
    } finally {
      resettingId.value = null
    }
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
    const fin = new Date(`${dateFin}T00:00:00`)
    return fin < today
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

  return {
    // État
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
    resetMessage,
    resetResultMessage,
    resetResultPassword,
    resettingId,

    // Méthodes
    fetchUsers,
    handleCreateUser,
    onRoleChange,

    // Suppression
    openDeleteModal,
    closeDeleteModal,
    confirmDeleteUser,

    // Prolongation
    openExtendModal,
    closeExtendModal,
    confirmExtendUser,

    // Réinitialisation mot de passe
    openResetModal,
    closeResetModal,
    closeResetResultModal,
    confirmResetPassword,

    // Utilitaires
    getStatusClass,
    getStatusLabel,
    isDateFinExpired,
  }
}
