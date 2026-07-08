// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TabNav from '../../../../src/components/TabNav.vue'

describe('TabNav', () => {
  it('affiche les onglets et emet le changement', async () => {
    const tabs = mount(TabNav, {
      props: {
        modelValue: 'ventes',
        tabs: [
          { key: 'ventes', label: 'Ventes', icon: 'V' },
          { key: 'rapports', label: 'Rapports' },
        ],
      },
    })

    await tabs.findAll('button')[1].trigger('click')

    expect(tabs.emitted('update:modelValue')[0]).toEqual(['rapports'])
    expect(tabs.emitted('change')[0]).toEqual(['rapports'])
    expect(tabs.findAll('button')[0].classes()).toContain('active')
  })
})
