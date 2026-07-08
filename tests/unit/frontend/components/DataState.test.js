// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import DataState from '../../../../src/components/DataState.vue'

describe('DataState', () => {
  it('affiche erreur, vide, chargement et action retry', async () => {
    const retry = vi.fn()
    const errorState = mount(DataState, {
      props: { error: 'Erreur reseau', onRetry: retry },
    })
    expect(errorState.text()).toContain('Erreur reseau')
    await errorState.find('button').trigger('click')
    expect(retry).toHaveBeenCalledTimes(1)

    const emptyState = mount(DataState, {
      props: { empty: true, emptyIcon: 'X', emptyMessage: 'Rien ici', emptyTitle: 'Vide' },
      slots: { 'empty-actions': '<button>Ajouter</button>' },
    })
    expect(emptyState.text()).toContain('Vide')
    expect(emptyState.text()).toContain('Ajouter')

    const loadingState = mount(DataState, {
      props: { loading: true, loadingText: 'Patience' },
    })
    expect(loadingState.text()).toContain('Patience')
  })
})
