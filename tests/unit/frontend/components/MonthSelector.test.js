// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MonthSelector from '../../../../src/components/MonthSelector.vue'

describe('MonthSelector', () => {
  it('emet la mise a jour du mois et rend les actions', async () => {
    const month = mount(MonthSelector, {
      props: { inputId: 'mois-test', modelValue: '2026-07' },
      slots: { actions: '<button>Exporter</button>' },
    })

    await month.find('input').setValue('2026-08')

    expect(month.emitted('update:modelValue')[0]).toEqual(['2026-08'])
    expect(month.text()).toContain('Exporter')
  })
})
