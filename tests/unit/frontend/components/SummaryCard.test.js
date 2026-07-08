// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SummaryCard from '../../../../src/components/SummaryCard.vue'

describe('SummaryCard', () => {
  it('affiche les totaux, commissions et variante visuelle', () => {
    const summary = mount(SummaryCard, {
      props: {
        commissionDetail: 'Taux personnalise',
        commissionLabelSuffix: ' artisan',
        title: 'Synthese',
        totalArticles: 3,
        totalCb: 24,
        totalCommission: 1.2,
        totalMontant: 32,
        variant: 'success',
      },
    })

    expect(summary.text()).toContain('Synthese')
    expect(summary.text()).toContain('32,00')
    expect(summary.text()).toContain('Commission CB artisan')
    expect(summary.classes()).toContain('summary-success')
  })
})
