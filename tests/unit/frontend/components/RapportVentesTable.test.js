// @vitest-environment happy-dom

import { shallowMount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import RapportVentesTable from '../../../../src/components/RapportVentesTable.vue'
import { ventesFixture } from '../../fixtures/salesFixtures'

const ventes = ventesFixture

describe('RapportVentesTable', () => {
  it('rend une table de rapport via VentesTable', () => {
    const wrapper = shallowMount(RapportVentesTable, {
      props: {
        summary: { total_articles: 3, total_montant: 32 },
        title: 'Atelier Alice',
        totalLabel: 'TOTAL ATELIER',
        ventes,
      },
    })

    expect(wrapper.text()).toContain('Atelier Alice')
    expect(wrapper.findComponent({ name: 'VentesTable' }).props()).toMatchObject({
      compactArticles: true,
      quantityLabel: 'Total Qté',
      totalLabel: 'TOTAL ATELIER',
      ventes,
    })
  })
})
