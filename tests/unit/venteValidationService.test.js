import { describe, expect, it } from 'vitest'
import validationService from '../../api/services/venteValidationService.cjs'

const {
  ValidationError,
  parseVentesListQuery,
  validateCreateVentePayload,
  validateUpdateVentePayload,
} = validationService

const validArticle = {
  article: 'Bol en ceramique',
  quantite: 2,
  prix: 18.5,
  artisan_id: 3,
}

describe('venteValidationService', () => {
  it('valide un payload de creation complet', () => {
    const payload = {
      articles: [validArticle],
      type_paiement: 'CB',
      date_vente: '2026-07-08',
    }

    expect(validateCreateVentePayload(payload)).toEqual(payload)
  })

  it('rejette une creation sans article exploitable', () => {
    expect(() =>
      validateCreateVentePayload({
        articles: [],
        type_paiement: 'CB',
        date_vente: '2026-07-08',
      }),
    ).toThrow(ValidationError)
  })

  it('rejette les types de paiement non supportes', () => {
    expect(() =>
      validateCreateVentePayload({
        articles: [validArticle],
        type_paiement: 'Virement',
        date_vente: '2026-07-08',
      }),
    ).toThrow('Type de paiement invalide')
  })

  it('rejette les articles dont quantite, prix ou artisan sont invalides', () => {
    expect(() =>
      validateCreateVentePayload({
        articles: [{ ...validArticle, quantite: 0 }],
        type_paiement: 'CB',
        date_vente: '2026-07-08',
      }),
    ).toThrow('quantité doit être un nombre entier supérieur à 0')

    expect(() =>
      validateCreateVentePayload({
        articles: [{ ...validArticle, prix: -1 }],
        type_paiement: 'CB',
        date_vente: '2026-07-08',
      }),
    ).toThrow('prix doit être supérieur à 0')

    expect(() =>
      validateCreateVentePayload({
        articles: [{ ...validArticle, artisan_id: 'abc' }],
        type_paiement: 'CB',
        date_vente: '2026-07-08',
      }),
    ).toThrow("l'artisan doit être valide")
  })

  it('autorise une mise a jour partielle mais valide les champs fournis', () => {
    expect(() => validateUpdateVentePayload({ type_paiement: 'Cheque' })).not.toThrow()
    expect(() => validateUpdateVentePayload({ date_vente: '08/07/2026' })).toThrow(
      'Date de vente invalide',
    )
    expect(() => validateUpdateVentePayload({ type_paiement: 'Ticket resto' })).toThrow(
      'Type de paiement invalide',
    )
  })

  it('normalise la pagination et conserve les filtres de liste', () => {
    expect(
      parseVentesListQuery({
        page: '2',
        limit: '25',
        date_debut: '2026-07-01',
        date_fin: '2026-07-31',
        type_paiement: 'Espece',
      }),
    ).toEqual({
      page: 2,
      limit: 25,
      date_debut: '2026-07-01',
      date_fin: '2026-07-31',
      type_paiement: 'Espece',
    })

    expect(parseVentesListQuery({ page: '-5', limit: '0' })).toEqual({
      page: 1,
      limit: 10,
      date_debut: undefined,
      date_fin: undefined,
      type_paiement: undefined,
    })
  })
})
