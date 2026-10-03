import { describe, expect, it } from 'vitest'
import moneyService from '../../../../api/services/moneyService.cjs'

const { addCents, articleAmountInCents, fromCents, percentageOfCents, toCents } = moneyService

describe('moneyService', () => {
  it.each([
    [1.005, 101],
    ['10.075', 1008],
    [0.1 + 0.2, 30],
    [1e-7, 0],
    [4e13, 4e15],
  ])('convertit le montant %s en %s centimes', (amount, cents) => {
    expect(toCents(amount)).toBe(cents)
  })

  it('préserve les taux à plus de deux décimales et le zéro explicite', () => {
    expect(percentageOfCents(100000, 1.2345)).toBe(1235)
    expect(percentageOfCents(100000, 0)).toBe(0)
    expect(percentageOfCents(Number.MAX_SAFE_INTEGER, 100)).toBe(Number.MAX_SAFE_INTEGER)
  })

  it('refuse de retourner un total inexact quand la précision entière est dépassée', () => {
    expect(() => addCents(Number.MAX_SAFE_INTEGER, 1)).toThrow(RangeError)
    expect(() => articleAmountInCents({ prix: 4e13, quantite: 3 })).toThrow(RangeError)
    expect(() => fromCents(8000000000000001)).toThrow(RangeError)
    expect(() => fromCents(Number.MAX_SAFE_INTEGER)).toThrow(RangeError)
  })

  it.each([
    NaN,
    Infinity,
    'invalide',
  ])('refuse un montant invalide au lieu de le transformer en zéro : %s', (prix) => {
    expect(() => articleAmountInCents({ prix, quantite: 1 })).toThrow(RangeError)
  })
})
