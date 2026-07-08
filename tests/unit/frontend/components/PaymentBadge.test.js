// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PaymentBadge from '../../../../src/components/PaymentBadge.vue'

describe('PaymentBadge', () => {
  it('affiche le libelle et la classe du type de paiement', () => {
    const badge = mount(PaymentBadge, { props: { type: 'CB' } })

    expect(badge.text()).toBe('Carte Bancaire')
    expect(badge.classes()).toContain('payment-cb')
  })
})
