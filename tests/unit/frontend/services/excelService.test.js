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
}

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
