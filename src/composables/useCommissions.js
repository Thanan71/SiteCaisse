/**
 * @module composables/useCommissions
 * @description Composable pour la gestion des paramètres de commissions CB.
 * Extrait la logique de fetch/save des commissions depuis AdminView.
 */
import { ref } from 'vue'
import api from '../services/api'

export function useCommissions() {
  const commissionPermanent = ref('')
  const commissionTemporaire = ref('')
  const savingCommissions = ref(false)
  const commissionsError = ref('')
  const commissionsSuccess = ref('')

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
      setTimeout(() => {
        commissionsSuccess.value = ''
      }, 3000)
    } catch (err) {
      commissionsError.value = err.response?.data?.error || "Erreur lors de l'enregistrement"
    } finally {
      savingCommissions.value = false
    }
  }

  return {
    commissionPermanent,
    commissionTemporaire,
    savingCommissions,
    commissionsError,
    commissionsSuccess,
    fetchParametres,
    handleSaveCommissions,
  }
}