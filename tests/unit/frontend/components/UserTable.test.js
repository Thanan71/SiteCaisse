// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import UserTable from '../../../../src/components/UserTable.vue'

describe('UserTable', () => {
  it('rend les utilisateurs et emet leurs actions', async () => {
    const wrapper = mount(UserTable, {
      props: {
        deletingId: null,
        extendingId: null,
        getStatusClass: (user) => (user.est_actif === false ? 'inactive' : 'active'),
        getStatusLabel: (user) => (user.est_actif === false ? 'Archivé' : 'Actif'),
        reactivatingId: null,
        resettingId: null,
        users: [
          {
            id: 1,
            nom: 'Admin',
            nom_boutique: 'Administration',
            role: 'admin',
            generated_password: 'admin1234',
            est_actif: true,
            created_at: '2026-07-08T10:00:00Z',
          },
          {
            id: 2,
            nom: 'Alice',
            nom_boutique: 'Atelier Alice',
            role: 'permanent',
            est_actif: true,
            created_at: '2026-07-08T10:00:00Z',
          },
          {
            id: 3,
            nom: 'Bruno',
            nom_boutique: 'Boutique Bruno',
            role: 'temporaire',
            est_actif: true,
            date_fin: '2026-08-31',
            created_at: '2026-07-08T10:00:00Z',
          },
          {
            id: 4,
            nom: 'Claire',
            nom_boutique: 'Atelier Claire',
            role: 'permanent',
            est_actif: false,
            created_at: '2026-07-08T10:00:00Z',
          },
        ],
      },
    })

    expect(wrapper.text()).toContain('Temporaire')
    expect(wrapper.text()).toContain('admin1234')

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Prolonger')
      .trigger('click')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Archiver')
      .trigger('click')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Désarchiver')
      .trigger('click')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'MDP')
      .trigger('click')

    expect(wrapper.emitted('extend')[0][0]).toMatchObject({ id: 3 })
    expect(wrapper.emitted('delete')[0][0]).toMatchObject({ id: 2 })
    expect(wrapper.emitted('reactivate')[0][0]).toMatchObject({ id: 4 })
    expect(wrapper.emitted('reset-password')[0][0]).toMatchObject({ id: 1 })
  })
})
