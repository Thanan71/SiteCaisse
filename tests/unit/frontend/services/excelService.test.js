import { saveAs } from 'file-saver'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as XLSX from 'xlsx'
import {
  exportAllRapportsToExcel,
  exportMonthToExcel,
  exportVentesToExcel,
} from '../../../../src/services/excelService'

vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}))

vi.mock('xlsx', () => ({
  utils: {
    book_append_sheet: vi.fn(),
    book_new: vi.fn(() => ({ sheets: [] })),
    json_to_sheet: vi.fn((rows) => ({ rows })),
  },
  write: vi.fn(() => new Uint8Array([1, 2, 3])),
}))

const ventes = [
  {
    id: 1,
    date_vente: '2026-07-08',
    type_paiement: 'CB',
    vendeur_nom: 'Admin',
    articles: [
      { article: 'Bol', quantite: 2, prix: 12 },
      { article: 'Tasse', quantite: 1, prix: 8 },
    ],
  },
]

const summary = {
  total_articles: 3,
  total_montant: 32,
  total_cb: 32,
  commission_cb: 0.8,
  taux_commission: 2.5,
  assiette_commission: 'cb',
}

const ventesMixtes = [
  ...ventes,
  {
    id: 2,
    date_vente: '2026-07-08',
    type_paiement: 'Espece',
    vendeur_nom: 'Admin',
    articles: [{ article: 'Vase', quantite: 1, prix: 20 }],
  },
  {
    id: 3,
    date_vente: '2026-07-08',
    type_paiement: 'Cheque',
    vendeur_nom: 'Admin',
    articles: [{ article: 'Assiette', quantite: 1, prix: 10 }],
  },
]

describe('excelService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-08T12:00:00Z'))
  })

  it('n exporte rien quand il n y a pas de donnees', () => {
    exportVentesToExcel([], [], 1, summary)
    exportMonthToExcel([], summary, {}, '2026-07')
    exportAllRapportsToExcel([], summary, {})

    expect(saveAs).not.toHaveBeenCalled()
    expect(XLSX.write).not.toHaveBeenCalled()
  })

  it('exporte les ventes d un artisan avec total et commission', () => {
    exportVentesToExcel(
      ventes,
      [{ id: 1, nom: 'Alice', nom_boutique: 'Atelier Alice' }],
      1,
      summary,
    )

    expect(XLSX.utils.json_to_sheet).toHaveBeenCalledWith([
      {
        Date: '2026-07-08',
        Article: 'Bol',
        Quantité: 2,
        'Prix unitaire (€)': 12,
        'Total (€)': '24.00',
        'Type de paiement': 'Carte Bancaire',
        'Vendu par': 'Admin',
      },
      {
        Date: '2026-07-08',
        Article: 'Tasse',
        Quantité: 1,
        'Prix unitaire (€)': 8,
        'Total (€)': '8.00',
        'Type de paiement': 'Carte Bancaire',
        'Vendu par': 'Admin',
      },
      {
        Date: '',
        Article: 'TOTAL',
        Quantité: 3,
        'Prix unitaire (€)': '',
        'Total (€)': '32.00',
        'Type de paiement': '',
        'Vendu par': '',
      },
      {
        Date: '',
        Article: 'Commission CB (2.5%)',
        Quantité: '',
        'Prix unitaire (€)': '',
        'Total (€)': '-0.80',
        'Type de paiement': 'sur 32.00€ de CB',
        'Vendu par': '',
      },
    ])
    expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), 'Rapport_Atelier Alice_2026-07-08.xlsx')
  })

  it.each([
    {
      cas: 'invite au taux general avec tous les moyens de paiement',
      assiette: 'tous_paiements',
      personnalisee: false,
      taux: 2.5,
      sansCB: false,
      commission: 1.55,
      libelle: 'Commission tous paiements (2.5%)',
      base: 'sur 62.00€ tous paiements',
    },
    {
      cas: 'invite au taux personnalise avec tous les moyens de paiement',
      assiette: 'tous_paiements',
      personnalisee: true,
      taux: 4,
      sansCB: false,
      commission: 2.48,
      libelle: 'Commission tous paiements personnalisée (4%)',
      base: 'sur 62.00€ tous paiements',
    },
    {
      cas: 'invite au taux general sans paiement CB',
      assiette: 'tous_paiements',
      personnalisee: false,
      taux: 2.5,
      sansCB: true,
      commission: 0.75,
      libelle: 'Commission tous paiements (2.5%)',
      base: 'sur 30.00€ tous paiements',
    },
    {
      cas: 'invite au taux personnalise sans paiement CB',
      assiette: 'tous_paiements',
      personnalisee: true,
      taux: 4,
      sansCB: true,
      commission: 1.2,
      libelle: 'Commission tous paiements personnalisée (4%)',
      base: 'sur 30.00€ tous paiements',
    },
    {
      cas: 'permanent au taux general avec tous les moyens de paiement',
      assiette: 'cb',
      personnalisee: false,
      taux: 2.5,
      sansCB: false,
      commission: 0.8,
      libelle: 'Commission CB (2.5%)',
      base: 'sur 32.00€ de CB',
    },
    {
      cas: 'permanent au taux personnalise avec tous les moyens de paiement',
      assiette: 'cb',
      personnalisee: true,
      taux: 4,
      sansCB: false,
      commission: 1.28,
      libelle: 'Commission CB personnalisée (4%)',
      base: 'sur 32.00€ de CB',
    },
  ])('exporte la bonne assiette pour un $cas', (scenario) => {
    exportVentesToExcel(
      scenario.sansCB ? ventesMixtes.slice(1) : ventesMixtes,
      [{ id: 1, nom: 'Alice' }],
      1,
      {
        total_articles: scenario.sansCB ? 2 : 5,
        total_montant: scenario.sansCB ? 30 : 62,
        total_cb: scenario.sansCB ? 0 : 32,
        commission_cb: scenario.commission,
        taux_commission: scenario.taux,
        commission_personnalisee: scenario.personnalisee,
        assiette_commission: scenario.assiette,
      },
    )

    const rows = XLSX.utils.json_to_sheet.mock.calls[0][0]
    expect(rows.at(-1)).toMatchObject({
      Article: scenario.libelle,
      'Total (€)': `-${scenario.commission.toFixed(2)}`,
      'Type de paiement': scenario.base,
    })
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ 'Type de paiement': 'Espèce' }),
        expect.objectContaining({ 'Type de paiement': 'Chèque' }),
      ]),
    )
  })

  it.each([
    { rapport: 'mensuel', exporter: exportMonthToExcel, totalLabel: 'TOTAL DU MOIS' },
    { rapport: 'global', exporter: exportAllRapportsToExcel, totalLabel: 'TOTAL GLOBAL' },
  ])('distingue les assiettes dans le recapitulatif $rapport', ({ exporter, totalLabel }) => {
    exporter(
      [
        { artisan_id: 1, artisan_nom: 'Permanent', ventes, summary },
        {
          artisan_id: 2,
          artisan_nom: 'Invite',
          ventes: ventesMixtes,
          summary: {
            ...summary,
            total_articles: 5,
            total_montant: 62,
            commission_cb: 1.55,
            assiette_commission: 'tous_paiements',
          },
        },
      ],
      { total_articles: 8, total_montant: 94, total_cb: 64, total_commission: 2.35 },
      { commission_cb_permanent: 1.5, commission_cb_temporaire: 2.5 },
      '2026-07',
    )

    const rows = XLSX.utils.json_to_sheet.mock.calls.at(-1)[0]
    expect(rows[0]).toMatchObject({
      Artisan: 'Permanent',
      'Assiette commission': 'CB',
      'Commission (€)': '0.80',
    })
    expect(rows[1]).toMatchObject({
      Artisan: 'Invite',
      'Total montant (€)': '62.00',
      'Total CB (€)': '32.00',
      'Assiette commission': 'Tous paiements',
      'Commission (€)': '1.55',
    })
    expect(rows[2]).toMatchObject({ Artisan: totalLabel, 'Commission (€)': '2.35' })
    expect(rows[4]).toMatchObject({ Artisan: 'Permanent', 'Assiette commission': 'CB' })
    expect(rows[5]).toMatchObject({ Artisan: 'Invité', 'Assiette commission': 'Tous paiements' })
    expect(rows.every((row) => !Object.hasOwn(row, 'Commission CB (€)'))).toBe(true)
  })

  it('exporte un rapport mensuel multi-onglets', () => {
    exportMonthToExcel(
      [
        {
          artisan_id: 1,
          artisan_nom: 'Atelier Alice',
          ventes,
          summary,
        },
      ],
      {
        total_articles: 3,
        total_montant: 32,
        total_cb: 32,
        total_commission: 0.8,
      },
      {
        commission_cb_permanent: 1.5,
        commission_cb_temporaire: 2.5,
      },
      '2026-07',
    )

    expect(XLSX.utils.book_append_sheet).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      'Rapport - Atelier Alice',
    )
    expect(XLSX.utils.book_append_sheet).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      'Résumé du mois',
    )
    expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), 'Rapport_mensuel_Juillet_2026.xlsx')
  })

  it('exporte tous les rapports avec une feuille globale', () => {
    exportAllRapportsToExcel(
      [
        {
          artisan_id: null,
          artisan_nom: '',
          ventes,
          summary,
        },
      ],
      {
        total_articles: 3,
        total_montant: 32,
        total_cb: 32,
        total_commission: 0.8,
      },
      {
        commission_cb_permanent: 1.5,
        commission_cb_temporaire: 2.5,
      },
    )

    expect(XLSX.utils.book_append_sheet).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      'Artisan inconnu',
    )
    expect(XLSX.utils.book_append_sheet).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      'Résumé global',
    )
    expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), 'Rapports_tous_artisans_2026-07-08.xlsx')
  })
})
