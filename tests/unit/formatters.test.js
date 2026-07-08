import { describe, expect, it } from 'vitest'
import {
  formatDate,
  formatDateSimple,
  formatDateTime,
  formatDateWithTime,
  formatMonthLabel,
  formatPrice,
  getPaymentLabel,
  parseUtcDate,
} from '../../src/utils/formatters'

describe('formatters', () => {
  it('formate les dates pour la France et le fuseau Europe/Paris', () => {
    expect(formatDate('2026-07-08')).toBe('08/07/2026')
    expect(formatDateTime('2026-07-08T12:34:00Z')).toBe('08/07/2026 14:34')
    expect(formatDateWithTime('2026-07-08', '2026-07-08T12:34:00Z')).toBe('08/07/2026 14:34')
    expect(formatDate('', 'n/a')).toBe('n/a')
  })

  it('formate les dates simples, mois, prix et paiements', () => {
    expect(formatDateSimple('2026-07-08')).toBe('08/07/2026')
    expect(formatMonthLabel('2026-07')).toBe('Juillet 2026')
    expect(getPaymentLabel('Espece')).toBe('Espèce')
    expect(getPaymentLabel('Virement')).toBe('Virement')
    expect(formatPrice(12.5)).toContain('12,50')
    expect(formatPrice(12.5)).toContain('€')
  })

  it('interprete les timestamps sans timezone comme UTC', () => {
    expect(parseUtcDate('2026-07-08T12:34:00').toISOString()).toBe('2026-07-08T12:34:00.000Z')
    expect(parseUtcDate('2026-07-08T12:34:00Z').toISOString()).toBe('2026-07-08T12:34:00.000Z')
  })
})
