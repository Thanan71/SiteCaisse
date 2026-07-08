import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../../../src/services/api'

vi.mock('../../../../src/services/api', () => ({
  default: {
    delete: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('alert', vi.fn())
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

import { useUsers } from '../../../../src/composables/useUsers'

describe('useUsers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-08T12:00:00Z'))
  })

  it('charge les utilisateurs en conservant un mot de passe genere localement', async () => {
    api.get.mockResolvedValueOnce({ data: [{ id: 1, nom: 'Alice', generated_password: '' }] })
    const users = useUsers()

    await users.fetchUsers()

    expect(api.get).toHaveBeenCalledWith('/api/admin/users')
    expect(users.users.value).toEqual([{ id: 1, nom: 'Alice', generated_password: '' }])
    expect(users.loading.value).toBe(false)
  })

  it('cree un utilisateur temporaire et affiche son mot de passe genere', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        message: 'Utilisateur cree',
        user: {
          id: 2,
          nom: 'Emma',
          nom_boutique: 'Atelier Emma',
          generated_password: 'atelieremma0042',
          role: 'temporaire',
        },
        newPassword: 'atelieremma0042',
      },
    })
    api.get.mockResolvedValueOnce({
      data: [
        {
          id: 2,
          nom: 'Emma',
          nom_boutique: 'Atelier Emma',
          generated_password: '',
          role: 'temporaire',
        },
      ],
    })
    const users = useUsers()
    users.newUser.value = {
      nom: 'Emma',
      nom_boutique: 'Atelier Emma',
      role: 'temporaire',
      date_fin: '2026-08-01',
    }

    await users.handleCreateUser()

    expect(api.post).toHaveBeenCalledWith('/api/admin/users', {
      nom: 'Emma',
      nom_boutique: 'Atelier Emma',
      role: 'temporaire',
      date_fin: '2026-08-01',
    })
    expect(users.showResetResultModal.value).toBe(true)
    expect(users.resetResultPassword.value).toBe('atelieremma0042')
    expect(users.users.value[0].generated_password).toBe('atelieremma0042')
    expect(users.newUser.value).toEqual({ nom: '', nom_boutique: '', role: '', date_fin: '' })
  })

  it('retire date_fin du payload permanent et gere les erreurs de creation', async () => {
    api.post.mockRejectedValueOnce({ response: { data: { error: 'Doublon boutique' } } })
    const users = useUsers()
    users.newUser.value = {
      nom: 'Marcel',
      nom_boutique: 'Atelier Marcel',
      role: 'permanent',
      date_fin: '2026-08-01',
    }

    await users.handleCreateUser()

    expect(api.post).toHaveBeenCalledWith('/api/admin/users', {
      nom: 'Marcel',
      nom_boutique: 'Atelier Marcel',
      role: 'permanent',
    })
    expect(users.createError.value).toBe('Doublon boutique')

    users.newUser.value.role = 'permanent'
    users.newUser.value.date_fin = '2026-08-01'
    users.onRoleChange()
    expect(users.newUser.value.date_fin).toBe('')
  })

  it('ouvre, valide et ferme les modales de commission personnalisee', async () => {
    api.patch.mockResolvedValueOnce({
      data: { user: { id: 1, commission_cb_personnalisee: 2.25 } },
    })
    const users = useUsers()
    users.users.value = [{ id: 1, nom: 'Alice', commission_cb_personnalisee: null }]

    users.openCreateCommissionModal()
    await users.confirmSaveCommission()
    expect(users.commissionError.value).toBe('Sélectionnez un utilisateur')

    users.selectedCommissionUserId.value = '1'
    await users.confirmSaveCommission()
    expect(users.commissionError.value).toBe('Renseignez un taux personnalisé')

    users.commissionDraft.value = '2.25'
    await users.confirmSaveCommission()

    expect(api.patch).toHaveBeenCalledWith('/api/admin/users/1/commission', {
      commission_cb_personnalisee: '2.25',
    })
    expect(users.users.value[0].commission_cb_personnalisee).toBe(2.25)
    expect(users.showCommissionModal.value).toBe(false)

    users.openCommissionModal({ id: 1, nom: 'Alice', commission_cb_personnalisee: 2.25 })
    expect(users.commissionModalMode.value).toBe('edit')
    expect(users.commissionDraft.value).toBe('2.25')
    users.closeCommissionModal()
    expect(users.showCommissionModal.value).toBe(false)
  })

  it('supprime une commission personnalisee ou alerte en cas d echec', async () => {
    api.patch
      .mockResolvedValueOnce({
        data: { user: { id: 1, commission_cb_personnalisee: null } },
      })
      .mockRejectedValueOnce({ response: { data: { error: 'Commission KO' } } })
    const users = useUsers()
    users.users.value = [{ id: 1, commission_cb_personnalisee: 2.25 }]

    await users.clearCustomCommission({ id: 1 })
    expect(users.users.value[0].commission_cb_personnalisee).toBeNull()

    await users.clearCustomCommission({ id: 1 })
    expect(alert).toHaveBeenCalledWith('Commission KO')
    expect(users.savingCommissionId.value).toBeNull()
  })

  it('archive, reactive et prolonge les utilisateurs', async () => {
    api.delete.mockResolvedValueOnce({})
    api.patch
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce({ response: { data: { error: 'Date KO' } } })
    api.get.mockResolvedValue({ data: [] })
    const users = useUsers()

    users.openDeleteModal({ id: 3, nom: 'Bob' })
    await users.confirmDeleteUser()
    expect(api.delete).toHaveBeenCalledWith('/api/admin/users/3')
    expect(users.showDeleteModal.value).toBe(false)

    await users.reactivateUser({ id: 3 })
    expect(api.patch).toHaveBeenCalledWith('/api/admin/users/3/reactivate')

    users.openExtendModal({ id: 4, nom: 'Temp', date_fin: '2026-07-30' })
    users.extendDateFin.value = '2026-08-30'
    await users.confirmExtendUser()
    expect(api.patch).toHaveBeenCalledWith('/api/admin/users/4/extend', {
      date_fin: '2026-08-30',
    })

    users.openExtendModal({ id: 4, nom: 'Temp', date_fin: '2026-07-30' })
    users.extendDateFin.value = '2026-08-30'
    await users.confirmExtendUser()
    expect(users.extendError.value).toBe('Date KO')
  })

  it('reinitialise un mot de passe et gere les modales de resultat', async () => {
    api.post.mockResolvedValueOnce({
      data: { message: 'Mot de passe OK', newPassword: 'secret0042' },
    })
    const users = useUsers()
    users.users.value = [{ id: 8, nom: 'Zoé', nom_boutique: 'Atelier Zoé' }]

    users.openResetModal({ id: 8, nom: 'Zoé', nom_boutique: 'Atelier Zoé' })
    expect(users.resetMessage.value).toContain('Zoé')

    await users.confirmResetPassword()

    expect(api.post).toHaveBeenCalledWith('/api/admin/users/8/reset-password')
    expect(users.showResetResultModal.value).toBe(true)
    expect(users.resetResultPassword.value).toBe('secret0042')
    expect(users.users.value[0].generated_password).toBe('secret0042')

    users.closeResetResultModal()
    expect(users.resetResultPassword.value).toBe('')
  })

  it('calcule le statut actif, archive et expire', () => {
    const users = useUsers()

    expect(users.isDateFinExpired('2026-07-07')).toBe(true)
    expect(users.isDateFinExpired('2026-07-08')).toBe(false)
    expect(users.getStatusClass({ est_actif: false })).toBe('inactive')
    expect(users.getStatusLabel({ est_actif: false })).toBe('Archivé')
    expect(users.getStatusClass({ est_actif: true, date_fin: '2026-07-07' })).toBe('expired')
    expect(users.getStatusLabel({ est_actif: true, date_fin: '2026-07-07' })).toBe('Expiré')
    expect(users.getStatusClass({ est_actif: true })).toBe('active')
    expect(users.getStatusLabel({ est_actif: true })).toBe('Oui')
  })
})
