import { saveAs } from 'file-saver'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as XLSX from 'xlsx'
import {
  exportAllRapportsToExcel,
  exportMonthToExcel,
  exportVentesToExcel,
} from '../../../../src/services/excelService'

vi.mock('file-saver', () => ({ saveAs: vi.fn() }))

const cases = [
  {
    nom: 'Permanent',
    assiette: 'cb',
    perso: true,
    cb: 100,
    taux: 3,
    frais: 3,
    credit: 100,
    net: 97,
  },
  {
    nom: 'Invite general',
    assiette: 'tous_paiements',
    perso: false,
    cb: 0,
    taux: 2.5,
    frais: 12.5,
    credit: 0,
    net: -12.5,
  },
  {
    nom: 'Invite personnalise',
    assiette: 'tous_paiements',
    perso: true,
    cb: 100,
    taux: 3,
    frais: 18,
    credit: 600,
    net: 582,
  },
  {
    nom: 'Invite zero',
    assiette: 'tous_paiements',
    perso: true,
    cb: 100,
    taux: 0,
    frais: 0,
    credit: 600,
    net: 600,
  },
]

function createGroup(scenario, index) {
  return {
    artisan_id: index + 1,
    artisan_nom: scenario.nom,
    ventes: [
      { type_paiement: 'CB', montant: scenario.cb },
      { type_paiement: 'Espece', montant: 200 },
      { type_paiement: 'Cheque', montant: 300 },
    ]
      .filter((vente) => vente.montant > 0)
      .map((vente) => ({
        date_vente: '2026-09-20',
        type_paiement: vente.type_paiement,
        articles: [{ article: 'Article', prix: vente.montant, quantite: 1 }],
      })),
    summary: {
      total_articles: scenario.cb > 0 ? 3 : 2,
      total_montant: scenario.cb + 500,
      total_cb: scenario.cb,
      commission_cb: scenario.frais,
      taux_commission: scenario.taux,
      commission_personnalisee: scenario.perso,
      assiette_commission: scenario.assiette,
    },
  }
}

describe('partie a facturer dans les fichiers XLSX generes', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each([
    'individuel',
    'mensuel',
    'global',
  ])('conserve les montants et formules dans l export %s', async (mode) => {
    const groupes = cases.map(createGroup)
    if (mode === 'individuel') {
      for (const groupe of groupes) {
        exportVentesToExcel(
          groupe.ventes,
          [{ id: groupe.artisan_id, nom: groupe.artisan_nom }],
          groupe.artisan_id,
          groupe.summary,
        )
      }
    } else {
      const total = {
        total_articles: 11,
        total_montant: 2300,
        total_cb: 300,
        total_commission: 33.5,
      }
      if (mode === 'mensuel') exportMonthToExcel(groupes, total, null, '2026-09')
      else exportAllRapportsToExcel(groupes, total, null)
    }

    const workbooks = await Promise.all(
      saveAs.mock.calls.map(async ([blob]) =>
        XLSX.read(await blob.arrayBuffer(), { type: 'array', cellNF: true }),
      ),
    )
    for (const [index, scenario] of cases.entries()) {
      const workbook = mode === 'individuel' ? workbooks[index] : workbooks[0]
      const worksheet = workbook.Sheets[workbook.SheetNames[mode === 'individuel' ? 0 : index]]
      const labels = Object.entries(worksheet).filter(([address]) => /^B\d+$/.test(address))
      expect(labels.some(([, cell]) => cell.v === 'À FACTURER')).toBe(true)
      expect(labels.some(([, cell]) => cell.v === `Artisan : ${scenario.nom}`)).toBe(true)

      const [creditAddress] = labels.find(([, cell]) => cell.v.startsWith('+ '))
      const [feeAddress] = labels.find(([, cell]) => cell.v.startsWith('- '))
      expect(worksheet[feeAddress].v).toBe(
        scenario.assiette === 'cb' ? '- Frais CB' : '- Frais de fonctionnement',
      )
      const [totalAddress] = labels.find(([, cell]) => cell.v === 'TOTAL À FACTURER')
      const creditCell = creditAddress.replace('B', 'E')
      const feeCell = feeAddress.replace('B', 'E')
      expect(worksheet[creditCell]).toMatchObject({ t: 'n', v: scenario.credit, z: '#,##0.00" €"' })
      expect(worksheet[feeCell]).toMatchObject({ t: 'n', v: scenario.frais ? -scenario.frais : 0 })
      expect(worksheet[totalAddress.replace('B', 'E')]).toMatchObject({
        t: 'n',
        v: scenario.net,
        f: `ROUND(SUM(${creditCell}:${feeCell}),2)`,
        z: '#,##0.00" €"',
      })
    }
  })
})
