// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ParametresCommissions from '../../../../src/components/ParametresCommissions.vue'

describe('ParametresCommissions', () => {
  it('emet les changements et sauvegarde les parametres de commission', async () => {
    const wrapper = mount(ParametresCommissions, {
      props: {
        commissionPermanent: '1.5',
        commissionTemporaire: '2.5',
        error: 'Erreur',
        saving: true,
        success: 'Sauvegarde',
      },
    })

    const inputs = wrapper.findAll('input')
    await inputs[0].setValue('1.75')
    await inputs[1].setValue('2.75')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.text()).toContain('Enregistrement...')
    expect(wrapper.text()).toContain('Erreur')
    expect(wrapper.text()).toContain('Sauvegarde')
    expect(wrapper.emitted('update:commission-permanent')[0]).toEqual(['1.75'])
    expect(wrapper.emitted('update:commission-temporaire')[0]).toEqual(['2.75'])
    expect(wrapper.emitted('save')).toHaveLength(1)
  })
})
