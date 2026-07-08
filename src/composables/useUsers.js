/**
 * @module useUsers
 * @description Composable encapsulant toute la logique métier de gestion des utilisateurs
 * (liste, création, archivage, prolongation, réinitialisation de mot de passe).
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
  const generatedPasswordsByUserId = new Map()

  // Création
  const creating = ref(false)
  const createError = ref('')
  const createSuccess = ref('')
  const newUser = ref({
    nom: '',
    nom_boutique: '',
    role: '',
    date_fin: '',
  })

  // Archivage / désactivation
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
  const resetResultTitle = ref('Mot de passe réinitialisé')
  const resetMessage = ref('')
  const resetResultMessage = ref('')
  const resetResultPassword = ref('')
  const resettingId = ref(null)

  // Commission personnalisée
  const showCommissionModal = ref(false)
  const userToEditCommission = ref(null)
  const commissionModalMode = ref('create')
  const selectedCommissionUserId = ref('')
  const commissionDraft = ref('')
  const commissionError = ref('')
  const savingCommissionId = ref(null)

  /**
   * Récupère la liste des utilisateurs depuis l'API.
   */
  async function fetchUsers() {
    try {
      loading.value = true
      const response = await api.get('/api/admin/users')
      users.value = (response.data || []).map((user) => ({
        ...user,
        generated_password:
          generatedPasswordsByUserId.get(user.id) || user.generated_password || '',
      }))
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

      const response = await api.post('/api/admin/users', payload)
      const createdUser = response.data.user || response.data
      const generatedPassword = response.data.newPassword || createdUser.generated_password || ''

      if (generatedPassword && createdUser.id) {
        generatedPasswordsByUserId.set(createdUser.id, generatedPassword)
      }

      createSuccess.value = `Utilisateur ${newUser.value.nom} créé avec succès !`
      if (generatedPassword) {
        resetResultTitle.value = 'Utilisateur créé'
        resetResultMessage.value =
          response.data.message || `Utilisateur ${newUser.value.nom} créé avec succès.`
        resetResultPassword.value = generatedPassword
        showResetResultModal.value = true
      }
      newUser.value = {
        nom: '',
        nom_boutique: '',
        role: '',
        date_fin: '',
      }
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

  // ---- Commission personnalisée ----

  function formatCommissionDraft(value) {
    if (value === null || value === undefined || value === '') return ''
    return String(value)
  }

  /**
   * Ouvre la modale d'ajout de commission personnalisée.
   */
  function openCreateCommissionModal() {
    userToEditCommission.value = null
    commissionModalMode.value = 'create'
    selectedCommissionUserId.value = ''
    commissionDraft.value = ''
    commissionError.value = ''
    showCommissionModal.value = true
  }

  /**
   * Ouvre la modale d'édition de commission personnalisée.
   * @param {Object} user
   */
  function openCommissionModal(user) {
    userToEditCommission.value = user
    commissionModalMode.value = 'edit'
    selectedCommissionUserId.value = user.id
    commissionDraft.value = formatCommissionDraft(user.commission_cb_personnalisee)
    commissionError.value = ''
    showCommissionModal.value = true
  }

  /**
   * Ferme la modale d'édition de commission.
   */
  function closeCommissionModal() {
    showCommissionModal.value = false
    userToEditCommission.value = null
    commissionModalMode.value = 'create'
    selectedCommissionUserId.value = ''
    commissionDraft.value = ''
    commissionError.value = ''
  }

  function getCommissionTargetUserId() {
    if (commissionModalMode.value === 'edit') return userToEditCommission.value?.id || null
    return selectedCommissionUserId.value || null
  }

  function updateUserCommission(userId, commission) {
    users.value = users.value.map((user) =>
      Number(user.id) === Number(userId)
        ? {
            ...user,
            commission_cb_personnalisee: commission,
          }
        : user,
    )
  }

  /**
   * Enregistre la commission personnalisée d'un utilisateur.
   */
  async function confirmSaveCommission() {
    const userId = getCommissionTargetUserId()
    if (!userId) {
      commissionError.value = 'Sélectionnez un utilisateur'
      return
    }

    if (commissionDraft.value === '') {
      commissionError.value = 'Renseignez un taux personnalisé'
      return
    }

    savingCommissionId.value = Number(userId)
    commissionError.value = ''

    try {
      const response = await api.patch(`/api/admin/users/${userId}/commission`, {
        commission_cb_personnalisee: commissionDraft.value,
      })
      const updatedUser = response.data.user
      updateUserCommission(updatedUser.id, updatedUser.commission_cb_personnalisee)
      closeCommissionModal()
    } catch (err) {
      commissionError.value = err.response?.data?.error || 'Erreur lors de la mise à jour'
    } finally {
      savingCommissionId.value = null
    }
  }

  /**
   * Retire la commission personnalisée pour revenir au taux général.
   * @param {Object} user
   */
  async function clearCustomCommission(user) {
    if (!user) return

    savingCommissionId.value = user.id

    try {
      const response = await api.patch(`/api/admin/users/${user.id}/commission`, {
        commission_cb_personnalisee: null,
      })
      const updatedUser = response.data.user
      updateUserCommission(updatedUser.id, updatedUser.commission_cb_personnalisee)
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur lors de la suppression de la commission')
    } finally {
      savingCommissionId.value = null
    }
  }

  // ---- Archivage / désactivation ----

  /**
   * Ouvre la modale de confirmation de désactivation.
   * @param {Object} user
   */
  function openDeleteModal(user) {
    userToDelete.value = user
    showDeleteModal.value = true
  }

  /**
   * Ferme la modale de désactivation.
   */
  function closeDeleteModal() {
    showDeleteModal.value = false
    userToDelete.value = null
  }

  /**
   * Confirme et exécute la désactivation d'un utilisateur.
   */
  async function confirmDeleteUser() {
    if (!userToDelete.value) return

    deletingId.value = userToDelete.value.id

    try {
      await api.delete(`/api/admin/users/${userToDelete.value.id}`)
      generatedPasswordsByUserId.delete(userToDelete.value.id)
      closeDeleteModal()
      await fetchUsers()
    } catch (err) {
      console.error('Erreur désactivation:', err)
      alert(err.response?.data?.error || 'Erreur lors de la désactivation')
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
    resetResultTitle.value = 'Mot de passe réinitialisé'
    resetResultMessage.value = ''
    resetResultPassword.value = ''
  }

  /**
   * Confirme et exécute la réinitialisation du mot de passe.
   */
  async function confirmResetPassword() {
    if (!userToReset.value) return

    resettingId.value = userToReset.value.id
    const resetUserId = userToReset.value.id

    try {
      const response = await api.post(`/api/admin/users/${userToReset.value.id}/reset-password`)
      closeResetModal()
      resetResultTitle.value = 'Mot de passe réinitialisé'
      resetResultMessage.value = response.data.message || 'Mot de passe réinitialisé avec succès.'
      resetResultPassword.value = response.data.newPassword || ''
      if (resetResultPassword.value) {
        generatedPasswordsByUserId.set(resetUserId, resetResultPassword.value)
        users.value = users.value.map((user) =>
          user.id === resetUserId
            ? { ...user, generated_password: resetResultPassword.value }
            : user,
        )
      }
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
    if (!user.est_actif) return 'Archivé'
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

    // Méthodes
    fetchUsers,
    handleCreateUser,
    onRoleChange,

    // Commission personnalisée
    openCreateCommissionModal,
    openCommissionModal,
    closeCommissionModal,
    confirmSaveCommission,
    clearCustomCommission,

    // Archivage / désactivation
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
