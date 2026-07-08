import { describe, expect, it } from 'vitest'
import { useExpandableRows } from '../../../../src/composables/useExpandableRows'

describe('useExpandableRows', () => {
  it('retourne une seule ligne tant que la cle n est pas deployee', () => {
    const rows = useExpandableRows()
    const items = ['a', 'b', 'c']

    expect(rows.getVisibleItems(items, 'vente-1')).toEqual(['a'])
    expect(rows.isExpanded('vente-1')).toBe(false)

    rows.toggleExpanded('vente-1')
    expect(rows.isExpanded('vente-1')).toBe(true)
    expect(rows.getVisibleItems(items, 'vente-1')).toEqual(items)

    rows.toggleExpanded('vente-1')
    expect(rows.getVisibleItems(items, 'vente-1')).toEqual(['a'])
    expect(rows.getVisibleItems(null, 'vente-1')).toEqual([])
    expect(rows.getVisibleItems(['seul'], 'vente-1')).toEqual(['seul'])
  })
})
