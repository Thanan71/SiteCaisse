/**
 * @module venteValidationService
 * @description Validation des payloads de ventes, isolée des contrôleurs Express.
 */
'use strict'

const VALID_PAYMENT_TYPES = ['CB', 'Espece', 'Cheque']

class ValidationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ValidationError'
    this.statusCode = 400
  }
}

function parsePositiveInteger(value, fallback) {
  const parsed = parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function validateArticles(articles, { required = true } = {}) {
  if (!articles) {
    if (required) throw new ValidationError('Au moins un article est requis')
    return
  }

  if (!Array.isArray(articles) || articles.length === 0) {
    throw new ValidationError(
      required ? 'Au moins un article est requis' : 'La liste des articles est invalide',
    )
  }

  for (const [index, article] of articles.entries()) {
    if (!article.article || !article.prix || !article.artisan_id) {
      throw new ValidationError(`Article ${index + 1} : le nom, le prix et l'artisan sont requis`)
    }

    if (Number(article.prix) <= 0) {
      throw new ValidationError(`Article ${index + 1} : le prix doit être supérieur à 0`)
    }
  }
}

function validateCreateVentePayload(payload = {}) {
  const { articles, type_paiement, date_vente } = payload

  validateArticles(articles, { required: true })

  if (!type_paiement || !date_vente) {
    throw new ValidationError('Champs requis : articles, type_paiement, date_vente')
  }

  if (!VALID_PAYMENT_TYPES.includes(type_paiement)) {
    throw new ValidationError('Type de paiement invalide (CB, Espece, Cheque)')
  }

  return { articles, type_paiement, date_vente }
}

function validateUpdateVentePayload(payload = {}) {
  validateArticles(payload.articles, { required: false })
}

function parseVentesListQuery(query = {}) {
  return {
    page: parsePositiveInteger(query.page, 1),
    limit: parsePositiveInteger(query.limit, 10),
    date_debut: query.date_debut || undefined,
    date_fin: query.date_fin || undefined,
    type_paiement: query.type_paiement || undefined,
  }
}

module.exports = {
  VALID_PAYMENT_TYPES,
  ValidationError,
  parseVentesListQuery,
  validateCreateVentePayload,
  validateUpdateVentePayload,
}
