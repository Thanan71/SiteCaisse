'use strict'

function assertSafeCents(value) {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError('Montant invalide ou supérieur à la précision monétaire supportée')
  }
  return value
}

function decimalRatio(value) {
  const number = Number(value ?? 0)
  if (!Number.isFinite(number)) throw new RangeError('Montant ou taux non numérique')
  const [coefficient, exponent = '0'] = String(number).split('e')
  const decimals = coefficient.split('.')[1]?.length || 0
  const scale = decimals - Number(exponent)
  const numerator = BigInt(coefficient.replace('.', ''))
  return scale < 0
    ? { numerator: numerator * 10n ** BigInt(-scale), denominator: 1n }
    : { numerator, denominator: 10n ** BigInt(scale) }
}

function roundRatio(numerator, denominator) {
  const quotient = numerator / denominator
  const remainder = numerator % denominator
  // Même arrondi que Math.round, sans approximation binaire au demi-centime.
  const adjustment = remainder * 2n >= denominator ? 1n : remainder * -2n > denominator ? -1n : 0n
  return assertSafeCents(Number(quotient + adjustment))
}

function toCents(value = 0) {
  const { numerator, denominator } = decimalRatio(value)
  return roundRatio(numerator * 100n, denominator)
}

function percentageOfCents(cents, percentage) {
  const { numerator, denominator } = decimalRatio(percentage)
  return roundRatio(BigInt(assertSafeCents(cents)) * numerator, denominator * 100n)
}

function fromCents(value) {
  const amount = assertSafeCents(value) / 100
  if (toCents(amount) !== value) {
    throw new RangeError('Montant trop élevé pour une restitution exacte en euros')
  }
  return amount
}

function addCents(left, right) {
  return assertSafeCents(left + right)
}

function articleAmountInCents(article) {
  const quantity = Number(article.quantite ?? 0)
  if (!Number.isSafeInteger(quantity)) throw new RangeError('Quantité non entière ou invalide')
  return assertSafeCents(toCents(article.prix) * quantity)
}

module.exports = { addCents, articleAmountInCents, fromCents, percentageOfCents, toCents }
