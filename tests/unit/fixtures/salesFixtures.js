export const artisansFixture = [
  {
    id: 2,
    nom: 'Alice',
    nom_boutique: 'Atelier Alice',
    role: 'permanent',
    est_actif: true,
  },
  {
    id: 3,
    nom: 'Bruno',
    nom_boutique: 'Boutique Bruno',
    role: 'temporaire',
    est_actif: false,
  },
]

export const ventesFixture = [
  {
    id: 10,
    type_paiement: 'CB',
    vendeur_nom: 'Admin',
    date_vente: '2026-07-08',
    created_at: '2026-07-08T10:00:00Z',
    total_articles: 3,
    total_montant: 32,
    articles: [
      { id: 100, article: 'Bol', quantite: 2, prix: 12, artisan_id: 2 },
      { id: 101, article: 'Tasse', quantite: 1, prix: 8, artisan_id: 3 },
    ],
  },
]
