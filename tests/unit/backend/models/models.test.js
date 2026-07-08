import bcrypt from 'bcryptjs'
import { describe, expect, it } from 'vitest'
import { createFakeSupabase } from '../../helpers/fakeSupabase'
import { loadCjsWithMocks } from '../../helpers/loadCjsWithMocks'

function loadModels(fake) {
  return loadCjsWithMocks('api/models.cjs', {
    'api/db.cjs': { getSupabase: () => fake.client },
  })
}

function createSalesFixture() {
  return createFakeSupabase({
    users: [
      {
        id: 1,
        nom: 'Admin',
        nom_boutique: 'Administration',
        role: 'admin',
        est_actif: true,
      },
      {
        id: 2,
        nom: 'Alice',
        nom_boutique: 'Atelier Alice',
        role: 'permanent',
        est_actif: true,
        commission_cb_personnalisee: null,
      },
      {
        id: 3,
        nom: 'Bruno',
        nom_boutique: 'Boutique Bruno',
        role: 'temporaire',
        est_actif: false,
        commission_cb_personnalisee: 2.5,
      },
    ],
    ventes: [
      {
        id: 10,
        type_paiement: 'CB',
        vendeur_id: 1,
        date_vente: '2026-07-08',
        created_at: '2026-07-08T10:00:00Z',
        vendeur: { nom: 'Admin' },
      },
      {
        id: 11,
        type_paiement: 'Espece',
        vendeur_id: 2,
        date_vente: '2026-06-15',
        created_at: '2026-06-15T10:00:00Z',
        vendeur: { nom: 'Alice' },
      },
    ],
    vente_articles: [
      { id: 100, vente_id: 10, article: 'Bol', quantite: 2, prix: 12, artisan_id: 2 },
      { id: 101, vente_id: 10, article: 'Tasse', quantite: 1, prix: 8, artisan_id: 3 },
      { id: 102, vente_id: 11, article: 'Vase', quantite: 1, prix: 30, artisan_id: 2 },
    ],
  })
}

describe('models', () => {
  it('retrouve les utilisateurs, change le mot de passe et filtre les artisans actifs', async () => {
    const oldHash = bcrypt.hashSync('ancien', 10)
    const fake = createFakeSupabase({
      users: [
        {
          id: 1,
          nom: 'Alice',
          nom_boutique: 'Atelier Alice',
          password_hash: oldHash,
          role: 'permanent',
          est_actif: true,
        },
        {
          id: 2,
          nom: 'Bruno',
          nom_boutique: 'Boutique Bruno',
          role: 'temporaire',
          est_actif: false,
        },
      ],
    })
    const { loaded, restore } = loadModels(fake)

    await expect(loaded.findUserByNomBoutique('Atelier Alice')).resolves.toMatchObject({
      id: 1,
      nom: 'Alice',
    })
    await expect(loaded.findUserById(1)).resolves.toMatchObject({
      id: 1,
      nom_boutique: 'Atelier Alice',
    })

    await expect(loaded.updatePassword(1, 'nouveau')).resolves.toBe(true)
    expect(fake.tables.users[0].generated_password).toBe('nouveau')
    expect(fake.tables.users[0].password_change_required).toBe(false)
    expect(bcrypt.compareSync('nouveau', fake.tables.users[0].password_hash)).toBe(true)

    await expect(loaded.getAllArtisans()).resolves.toEqual([
      expect.objectContaining({ id: 1, nom_boutique: 'Atelier Alice' }),
    ])
    await expect(loaded.getAllArtisans({ includeInactive: true })).resolves.toHaveLength(2)

    restore()
  })

  it('cree une vente et retourne les ventes paginees avec leurs articles formates', async () => {
    const fake = createSalesFixture()
    const { loaded, restore } = loadModels(fake)

    await expect(
      loaded.createVente(
        [{ article: 'Assiette', prix: 14, artisan_id: 2 }],
        'Cheque',
        1,
        '2026-07-09',
      ),
    ).resolves.toBe(12)

    expect(fake.tables.ventes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 12,
          type_paiement: 'Cheque',
          vendeur_id: 1,
          date_vente: '2026-07-09',
        }),
      ]),
    )
    expect(fake.tables.vente_articles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          vente_id: 12,
          article: 'Assiette',
          quantite: 1,
          prix: 14,
          artisan_id: 2,
        }),
      ]),
    )

    await expect(
      loaded.getAllVentes({
        page: '1',
        limit: '1',
        date_debut: '2026-07-01',
        date_fin: '2026-07-31',
        type_paiement: 'CB',
      }),
    ).resolves.toEqual({
      ventes: [
        expect.objectContaining({
          id: 10,
          artisan_id: null,
          vendeur_nom: 'Admin',
          total_articles: 3,
          total_montant: 32,
          articles: [
            expect.objectContaining({ article: 'Bol' }),
            expect.objectContaining({ article: 'Tasse' }),
          ],
        }),
      ],
      pagination: { page: 1, limit: 1, total: 1, totalPages: 1 },
    })

    restore()
  })

  it('met a jour les ventes, remplace leurs articles et supprime une vente', async () => {
    const fake = createSalesFixture()
    const { loaded, restore } = loadModels(fake)

    await expect(
      loaded.updateVente(10, {
        type_paiement: 'Cheque',
        date_vente: '2026-07-10',
        articles: [{ article: 'Pichet', quantite: 3, prix: 9, artisan_id: 2 }],
      }),
    ).resolves.toBe(true)

    expect(fake.tables.ventes.find((vente) => vente.id === 10)).toMatchObject({
      type_paiement: 'Cheque',
      date_vente: '2026-07-10',
    })
    expect(fake.tables.vente_articles.filter((article) => article.vente_id === 10)).toEqual([
      expect.objectContaining({
        article: 'Pichet',
        quantite: 3,
        prix: 9,
        artisan_id: 2,
      }),
    ])

    await expect(loaded.deleteVente(11)).resolves.toBe(true)
    expect(fake.tables.ventes.some((vente) => vente.id === 11)).toBe(false)

    restore()
  })

  it('alimente les rapports artisan et mensuels depuis les ventes formatees', async () => {
    const fake = createSalesFixture()
    const { loaded, restore } = loadModels(fake)

    await expect(loaded.getVentesByArtisan(2)).resolves.toMatchObject({
      summary: { total_articles: 3, total_montant: 54 },
      ventes: [
        expect.objectContaining({ id: 10, total_articles: 2, total_montant: 24 }),
        expect.objectContaining({ id: 11, total_articles: 1, total_montant: 30 }),
      ],
    })

    await expect(loaded.getAllVentesGroupedByArtisan()).resolves.toMatchObject({
      total: { total_articles: 4, total_montant: 62 },
      groupes: expect.arrayContaining([
        expect.objectContaining({
          artisan_id: 2,
          artisan_nom: 'Atelier Alice',
          summary: { total_articles: 3, total_montant: 54 },
        }),
        expect.objectContaining({
          artisan_id: 3,
          artisan_nom: 'Boutique Bruno',
          summary: { total_articles: 1, total_montant: 8 },
        }),
      ]),
    })

    await expect(loaded.getAllVentesGroupedByMonth()).resolves.toMatchObject({
      total: { total_articles: 4, total_montant: 62 },
      mois: [
        expect.objectContaining({
          mois: '2026-07',
          total: { total_articles: 3, total_montant: 32 },
        }),
        expect.objectContaining({
          mois: '2026-06',
          total: { total_articles: 1, total_montant: 30 },
        }),
      ],
    })

    await expect(loaded.getVentesByMonth('2026-07')).resolves.toMatchObject({
      total: { total_articles: 3, total_montant: 32 },
    })

    await expect(loaded.getAllVentesGroupedByArtisan({ page: 1, limit: 1 })).resolves.toMatchObject(
      {
        pagination: { page: 1, limit: 1, total: 2, totalPages: 2 },
        total: { total_articles: 3, total_montant: 32 },
      },
    )

    restore()
  })

  it('prolonge une date de fin et reinitialise un mot de passe utilisateur', async () => {
    const fake = createFakeSupabase({
      users: [
        {
          id: 2,
          nom: 'Bruno',
          nom_boutique: 'Boutique Bruno',
          password_hash: bcrypt.hashSync('ancien', 10),
          date_fin: '2026-07-31',
        },
      ],
    })
    const { loaded, restore } = loadModels(fake)

    await expect(loaded.extendUserDateFin(2, '2026-08-31')).resolves.toBe(true)
    expect(fake.tables.users[0].date_fin).toBe('2026-08-31')

    await expect(loaded.resetUserPassword(2, 'boutique1234')).resolves.toBe('boutique1234')
    expect(fake.tables.users[0].generated_password).toBe('boutique1234')
    expect(fake.tables.users[0].password_change_required).toBe(false)
    expect(bcrypt.compareSync('boutique1234', fake.tables.users[0].password_hash)).toBe(true)
    await expect(loaded.resetUserPassword(2, '')).rejects.toThrow('Nouveau mot de passe requis')

    restore()
  })
})
