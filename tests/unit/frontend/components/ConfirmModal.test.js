// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ConfirmModal from '../../../../src/components/ConfirmModal.vue'

describe('ConfirmModal', () => {
  it('affiche le contenu et emet confirm ou cancel', async () => {
    const modal = mount(ConfirmModal, {
      props: {
        confirmText: 'Supprimer',
        message: 'Action irreversible',
        show: true,
        title: 'Confirmer',
        variant: 'danger',
        warning: 'Attention',
      },
      slots: { default: '<strong>detail</strong>' },
    })

    expect(modal.text()).toContain('Action irreversible')
    expect(modal.find('.modal-content').classes()).toContain('modal-danger')
    expect(modal.findAll('button')[1].classes()).toContain('btn-danger')

    await modal.findAll('button')[1].trigger('click')
    await modal.findAll('button')[0].trigger('click')

    expect(modal.emitted('confirm')).toHaveLength(1)
    expect(modal.emitted('cancel')).toHaveLength(1)
  })
})
