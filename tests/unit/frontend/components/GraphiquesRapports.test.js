// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import GraphiquesRapports from '../../../../src/components/GraphiquesRapports.vue'

vi.mock('vue-chartjs', () => {
  function createChartStub(name) {
    return {
      name,
      props: {
        data: { type: Object, required: true },
        options: { type: Object, required: true },
      },
      template: `<div class="${name.toLowerCase()}-chart"></div>`,
    }
  }

  return {
    Bar: createChartStub('Bar'),
    Doughnut: createChartStub('Doughnut'),
    Line: createChartStub('Line'),
    Pie: createChartStub('Pie'),
  }
})

describe('graphiques', () => {
  it('prepare les jeux de donnees pour les graphiques globaux', async () => {
    const wrapper = mount(GraphiquesRapports, {
      props: {
        groupesData: [
          { artisan_nom: 'Atelier Alice', summary: { total_montant: 32 } },
          { artisan_nom: 'Boutique Bruno', summary: { total_montant: 10 } },
        ],
        isGlobal: true,
        ventesData: [
          {
            id: 10,
            artisan_nom: 'Atelier Alice',
            type_paiement: 'CB',
            date_vente: '2026-07-06',
            created_at: '2026-07-06T08:00:00Z',
            total_articles: 3,
            total_montant: 32,
            articles: [{ article: 'Bol', quantite: 2, prix: 12, artisan_id: 2 }],
          },
          {
            id: 11,
            artisan_nom: 'Boutique Bruno',
            type_paiement: 'Cheque',
            date_vente: '2026-06-15',
            created_at: '2026-06-15T15:00:00Z',
            total_articles: 1,
            total_montant: 10,
            articles: [{ article: 'Tasse', quantite: 1, prix: 10, artisan_id: 3 }],
          },
          {
            id: 12,
            type_paiement: 'Virement',
            date_vente: '',
            total_articles: 0,
            total_montant: 99,
            articles: [],
          },
        ],
      },
    })

    await wrapper.find('#graph-month-select').setValue('7')

    const doughnut = wrapper.findComponent({ name: 'Doughnut' })
    expect(doughnut.props('data').labels).toEqual(['Carte Bancaire', 'Espèce', 'Chèque'])
    expect(doughnut.props('data').datasets[0].data).toEqual([32, 0, 10])

    const bars = wrapper.findAllComponents({ name: 'Bar' })
    expect(bars[0].props('data').labels).toEqual([
      'Lundi',
      'Mardi',
      'Mercredi',
      'Jeudi',
      'Vendredi',
      'Samedi',
      'Dimanche',
    ])
    expect(bars[0].props('data').datasets[0].data.some((value) => value === 32)).toBe(true)
    expect(bars[1].props('data').labels[8]).toBe('08h')
    expect(bars[1].props('data').datasets[0].data.some((value) => value === 32)).toBe(true)

    const line = wrapper.findComponent({ name: 'Line' })
    expect(line.props('data').labels).toEqual(['Juin', 'Juil'])
    expect(line.props('data').datasets[0].data).toEqual([10, 32])
    expect(line.props('data').datasets[1].data).toEqual([1, 1])

    const pie = wrapper.findComponent({ name: 'Pie' })
    expect(pie.props('data').labels).toEqual(['Atelier Alice', 'Boutique Bruno'])
    expect(pie.props('data').datasets[0].data).toEqual([32, 10])
  })

  it('masque le graphique artisan en vue individuelle', () => {
    const wrapper = mount(GraphiquesRapports, {
      props: {
        isGlobal: false,
        ventesData: [],
      },
    })

    expect(wrapper.findComponent({ name: 'Pie' }).exists()).toBe(false)
  })
})
