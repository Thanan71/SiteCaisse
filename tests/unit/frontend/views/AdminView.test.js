// @vitest-environment happy-dom

import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import AdminView from '../../../../src/views/AdminView.vue'
import { commonViewStubs, installViewTest } from './viewTestUtils'

const composableMocks = vi.hoisted(() => ({
  useCommissions: vi.fn(),
  useLogs: vi.fn(),
  useUsers: vi.fn(),
}))

vi.mock('../../../../src/composables/useUsers', () => ({
  useUsers: composableMocks.useUsers,
}))

vi.mock('../../../../src/composables/useCommissions', () => ({
  useCommissions: composableMocks.useCommissions,
}))

vi.mock('../../../../src/composables/useLogs', () => ({
  useLogs: composableMocks.useLogs,
}))

let commissionsMock
let logsMock
let usersMock

beforeEach(() => {
  installViewTest()
  usersMock = createUsersMock()
  commissionsMock = createCommissionsMock()
  logsMock = createLogsMock()
  composableMocks.useUsers.mockReturnValue(usersMock)
  composableMocks.useCommissions.mockReturnValue(commissionsMock)
  composableMocks.useLogs.mockReturnValue(logsMock)
})

const adminViewStubs = {
  ...commonViewStubs,
  ConfirmModal: {
    emits: ['cancel', 'confirm'],
    props: ['show', 'title'],
    template: `
      <section v-if="show" data-testid="confirm-modal">
        <span>{{ title }}</span>
        <button type="button" @click="$emit('confirm')">confirmer</button>
        <button type="button" @click="$emit('cancel')">annuler</button>
      </section>
    `,
  },
  LogsViewer: {
    emits: ['apply-filters', 'change-page', 'fetch', 'update:log-filters'],
    props: ['logs', 'logsLoading', 'logsError', 'logFilters', 'logsPagination'],
    template: `
      <section data-testid="logs-viewer">
        <button type="button" @click="$emit('fetch')">fetch logs</button>
        <button type="button" @click="$emit('apply-filters')">apply logs</button>
        <button type="button" @click="$emit('change-page', 2)">page logs</button>
        <button
          type="button"
          @click="$emit('update:log-filters', { action: 'vente.create', cible_type: 'vente' })"
        >
          update filters
        </button>
      </section>
    `,
  },
  ParametresCommissions: {
    emits: ['save', 'update:commission-permanent', 'update:commission-temporaire'],
    props: ['commissionPermanent', 'commissionTemporaire', 'saving', 'error', 'success'],
    template: `
      <section data-testid="parametres-commissions">
        <button
          type="button"
          data-testid="save-commissions"
          @click="
            $emit('update:commission-permanent', 2);
            $emit('update:commission-temporaire', 3);
            $emit('save')
          "
        >
          sauver commissions
        </button>
      </section>
    `,
  },
  UserTable: {
    emits: ['delete', 'extend', 'reactivate', 'reset-password'],
    props: [
      'users',
      'deletingId',
      'reactivatingId',
      'extendingId',
      'resettingId',
      'getStatusClass',
      'getStatusLabel',
    ],
    template: `
      <section data-testid="user-table">
        <button type="button" data-testid="user-delete" @click="$emit('delete', users[0])">
          archiver
        </button>
        <button type="button" data-testid="user-extend" @click="$emit('extend', users[1])">
          prolonger
        </button>
        <button type="button" data-testid="user-reactivate" @click="$emit('reactivate', users[1])">
          reactiver
        </button>
        <button type="button" data-testid="user-reset" @click="$emit('reset-password', users[0])">
          reset
        </button>
      </section>
    `,
  },
}

function createUsersMock() {
  return {
    clearCustomCommission: vi.fn(),
    closeCommissionModal: vi.fn(),
    closeDeleteModal: vi.fn(),
    closeExtendModal: vi.fn(),
    closeResetModal: vi.fn(),
    closeResetResultModal: vi.fn(),
    commissionDraft: ref(''),
    commissionError: ref(''),
    commissionModalMode: ref('edit'),
    confirmDeleteUser: vi.fn(),
    confirmExtendUser: vi.fn(),
    confirmResetPassword: vi.fn(),
    confirmSaveCommission: vi.fn(),
    createError: ref(''),
    createSuccess: ref(''),
    creating: ref(false),
    deletingId: ref(null),
    extendDateFin: ref('2026-08-01'),
    extendError: ref(''),
    extendingId: ref(null),
    fetchUsers: vi.fn(),
    getStatusClass: vi.fn(() => 'status-active'),
    getStatusLabel: vi.fn(() => 'Actif'),
    handleCreateUser: vi.fn(),
    loading: ref(false),
    newUser: ref({ date_fin: '', nom: '', nom_boutique: '', role: '' }),
    onRoleChange: vi.fn(),
    openCommissionModal: vi.fn(),
    openCreateCommissionModal: vi.fn(),
    openDeleteModal: vi.fn(),
    openExtendModal: vi.fn(),
    openResetModal: vi.fn(),
    reactivatingId: ref(null),
    reactivateUser: vi.fn(),
    resetMessage: ref('Confirmer la reinitialisation'),
    resetResultMessage: ref('Mot de passe genere'),
    resetResultPassword: ref('atelier1234'),
    resetResultTitle: ref('Mot de passe reinitialise'),
    resettingId: ref(null),
    savingCommissionId: ref(null),
    selectedCommissionUserId: ref(''),
    showCommissionModal: ref(false),
    showDeleteModal: ref(false),
    showExtendModal: ref(false),
    showResetModal: ref(false),
    showResetResultModal: ref(false),
    userToDelete: ref(null),
    userToEditCommission: ref(null),
    userToExtend: ref(null),
    userToReset: ref(null),
    users: ref([
      {
        commission_cb_personnalisee: 1.75,
        id: 1,
        nom: 'Alice',
        nom_boutique: 'Atelier Alice',
        role: 'permanent',
      },
      {
        commission_cb_personnalisee: null,
        date_fin: '2026-07-31',
        id: 2,
        nom: 'Bruno',
        nom_boutique: 'Boutique Bruno',
        role: 'temporaire',
      },
      {
        commission_cb_personnalisee: null,
        id: 3,
        nom: 'Admin',
        nom_boutique: 'Administration',
        role: 'admin',
      },
    ]),
  }
}

function createCommissionsMock() {
  return {
    commissionPermanent: ref(1.5),
    commissionTemporaire: ref(2.5),
    commissionsError: ref(''),
    commissionsSuccess: ref(''),
    fetchParametres: vi.fn(),
    handleSaveCommissions: vi.fn(),
    savingCommissions: ref(false),
  }
}

function createLogsMock() {
  return {
    applyLogFilters: vi.fn(),
    changeLogsPage: vi.fn(),
    fetchLogs: vi.fn(),
    logFilters: ref({ action: '', cible_type: '' }),
    logs: ref([{ id: 1, action: 'vente.create' }]),
    logsError: ref(''),
    logsLoading: ref(false),
    logsPagination: ref({ limit: 20, page: 1, total: 1, totalPages: 1 }),
  }
}

function mountAdminView() {
  return mount(AdminView, {
    global: { stubs: adminViewStubs },
  })
}

function findButtonByText(wrapper, text) {
  const button = wrapper.findAll('button').find((candidate) => candidate.text().includes(text))

  if (!button) {
    throw new Error(`Bouton introuvable: ${text}`)
  }

  return button
}

describe('AdminView', () => {
  it('charge les donnees admin et connecte le panneau utilisateurs', async () => {
    const wrapper = mountAdminView()
    await flushPromises()

    expect(usersMock.fetchUsers).toHaveBeenCalledTimes(1)
    expect(commissionsMock.fetchParametres).toHaveBeenCalledTimes(1)
    expect(logsMock.fetchLogs).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Utilisateurs (3)')

    await wrapper.find('[data-testid="user-delete"]').trigger('click')
    await wrapper.find('[data-testid="user-extend"]').trigger('click')
    await wrapper.find('[data-testid="user-reactivate"]').trigger('click')
    await wrapper.find('[data-testid="user-reset"]').trigger('click')

    expect(usersMock.openDeleteModal).toHaveBeenCalledWith(usersMock.users.value[0])
    expect(usersMock.openExtendModal).toHaveBeenCalledWith(usersMock.users.value[1])
    expect(usersMock.reactivateUser).toHaveBeenCalledWith(usersMock.users.value[1])
    expect(usersMock.openResetModal).toHaveBeenCalledWith(usersMock.users.value[0])
  })

  it('separe les commissions personnalisees et connecte leurs actions', async () => {
    const wrapper = mountAdminView()
    await flushPromises()

    await wrapper.find('[data-testid="tab-commissions"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Commissions personnalisées')
    expect(wrapper.text()).toContain('1,75%')

    await wrapper.find('[data-testid="save-commissions"]').trigger('click')
    expect(commissionsMock.commissionPermanent.value).toBe(2)
    expect(commissionsMock.commissionTemporaire.value).toBe(3)
    expect(commissionsMock.handleSaveCommissions).toHaveBeenCalledTimes(1)

    await findButtonByText(wrapper, 'Ajouter une commission personnalisée').trigger('click')
    await findButtonByText(wrapper, 'Supprimer').trigger('click')

    expect(usersMock.openCreateCommissionModal).toHaveBeenCalledTimes(1)
    expect(usersMock.clearCustomCommission).toHaveBeenCalledWith(usersMock.users.value[0])
  })

  it('connecte le panneau logs au composable dedie', async () => {
    const wrapper = mountAdminView()
    await flushPromises()

    await wrapper.find('[data-testid="tab-logs"]').trigger('click')
    await flushPromises()

    await wrapper.findAll('[data-testid="logs-viewer"] button')[0].trigger('click')
    await wrapper.findAll('[data-testid="logs-viewer"] button')[1].trigger('click')
    await wrapper.findAll('[data-testid="logs-viewer"] button')[2].trigger('click')
    await wrapper.findAll('[data-testid="logs-viewer"] button')[3].trigger('click')

    expect(logsMock.fetchLogs).toHaveBeenCalledTimes(2)
    expect(logsMock.applyLogFilters).toHaveBeenCalledTimes(1)
    expect(logsMock.changeLogsPage).toHaveBeenCalledWith(2)
    expect(logsMock.logFilters.value).toEqual({ action: 'vente.create', cible_type: 'vente' })
  })

  it('affiche les modales metier et connecte leurs validations', async () => {
    const wrapper = mountAdminView()
    await flushPromises()

    usersMock.showExtendModal.value = true
    usersMock.userToExtend.value = usersMock.users.value[1]
    usersMock.showCommissionModal.value = true
    usersMock.commissionModalMode.value = 'create'
    usersMock.showResetModal.value = true
    usersMock.showResetResultModal.value = true
    await flushPromises()

    expect(wrapper.text()).toContain("Prolonger l'accès de Bruno")
    expect(wrapper.text()).toContain('Ajouter une commission personnalisée')
    expect(wrapper.text()).toContain('Mot de passe genere')

    await findButtonByText(wrapper, 'Prolonger').trigger('click')
    await findButtonByText(wrapper, 'Enregistrer').trigger('click')
    await findButtonByText(wrapper, 'Fermer').trigger('click')
    await wrapper.find('[data-testid="confirm-modal"] button').trigger('click')

    expect(usersMock.confirmExtendUser).toHaveBeenCalledTimes(1)
    expect(usersMock.confirmSaveCommission).toHaveBeenCalledTimes(1)
    expect(usersMock.closeResetResultModal).toHaveBeenCalledTimes(1)
    expect(usersMock.confirmResetPassword).toHaveBeenCalledTimes(1)
  })
})
