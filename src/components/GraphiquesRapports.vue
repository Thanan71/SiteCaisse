<template>
  <div class="graphiques-container">
    <h2 class="section-title">Statistiques graphiques</h2>
    <div class="charts-grid">
      <!-- Graphique : Répartition par type de paiement -->
      <div class="chart-card">
        <h3 class="chart-title">Répartition par type de paiement</h3>
        <div class="chart-wrapper">
          <Doughnut :data="paymentChartData" :options="paymentChartOptions" />
        </div>
      </div>

      <!-- Graphique : Meilleurs jours de vente par semaine -->
      <div class="chart-card">
        <div class="chart-card-header">
          <h3 class="chart-title">Meilleurs jours de vente</h3>
          <div class="chart-filter-row">
            <label for="graph-month-select">Mois :</label>
            <select id="graph-month-select" v-model="selectedMonth" class="chart-month-select">
              <option v-for="option in monthOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
        </div>
        <div class="chart-wrapper">
          <Bar :data="weekdaySalesChartData" :options="weekdaySalesChartOptions" />
        </div>
      </div>

      <!-- Graphique : Meilleurs horaires de vente -->
      <div class="chart-card">
        <div class="chart-card-header">
          <h3 class="chart-title">Meilleurs horaires de vente</h3>
          <div class="chart-filter-row">
            <label for="graph-hour-month-select">Mois :</label>
            <select id="graph-hour-month-select" v-model="selectedMonth" class="chart-month-select">
              <option v-for="option in monthOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
        </div>
        <div class="chart-wrapper">
          <Bar :data="hourlySalesChartData" :options="hourlySalesChartOptions" />
        </div>
      </div>

      <!-- Graphique : Évolution mensuelle des ventes -->
      <div class="chart-card chart-card-wide">
        <h3 class="chart-title">Évolution mensuelle des ventes</h3>
        <div class="chart-wrapper">
          <Line :data="monthlyChartData" :options="monthlyChartOptions" />
        </div>
      </div>

      <!-- Graphique : Répartition par artisan (vue globale uniquement) -->
      <div v-if="isGlobal" class="chart-card">
        <h3 class="chart-title">Répartition par artisan</h3>
        <div class="chart-wrapper">
          <Pie :data="artisanChartData" :options="artisanChartOptions" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js'
import { computed, ref } from 'vue'
import { Bar, Doughnut, Line, Pie } from 'vue-chartjs'

// Enregistrer les composants Chart.js
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Filler,
)

const props = defineProps({
  /** Liste des ventes groupées par artisan (mode global) ou ventes d'un artisan */
  ventesData: {
    type: Array,
    required: true,
  },
  /** Si true, affiche les graphiques pour tous les artisans. Sinon pour un seul artisan */
  isGlobal: {
    type: Boolean,
    default: true,
  },
  /** Données des groupes (nécessaire pour le graphique par artisan) */
  groupesData: {
    type: Array,
    default: () => [],
  },
})

/**
 * Extrait tous les articles de toutes les ventes.
 */
const allArticles = computed(() => {
  const items = []
  for (const vente of props.ventesData) {
    if (vente.articles) {
      for (const art of vente.articles) {
        items.push({
          ...art,
          date_vente: vente.date_vente,
          type_paiement: vente.type_paiement,
          artisan_nom: vente.artisan_nom,
        })
      }
    }
  }
  return items
})

/**
 * Calculs pour le graphique de répartition par type de paiement.
 */
const paymentChartData = computed(() => {
  const counts = { CB: 0, Espece: 0, Cheque: 0 }
  for (const vente of props.ventesData) {
    if (counts[vente.type_paiement] !== undefined) {
      counts[vente.type_paiement] += vente.total_montant
    }
  }
  return {
    labels: ['Carte Bancaire', 'Espèce', 'Chèque'],
    datasets: [
      {
        data: [counts.CB, counts.Espece, counts.Cheque],
        backgroundColor: ['#2563eb', '#059669', '#d97706'],
        borderWidth: 2,
        borderColor: '#ffffff',
      },
    ],
  }
})

const paymentChartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        padding: 16,
        usePointStyle: true,
        font: { size: 12 },
      },
    },
    tooltip: {
      callbacks: {
        label: (ctx) => {
          const total = ctx.dataset.data.reduce((a, b) => a + b, 0)
          const value = ctx.raw
          const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0
          return `${ctx.label}: ${value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} (${pct}%)`
        },
      },
    },
  },
}

const monthOptions = [
  { value: 1, label: 'Janvier' },
  { value: 2, label: 'Février' },
  { value: 3, label: 'Mars' },
  { value: 4, label: 'Avril' },
  { value: 5, label: 'Mai' },
  { value: 6, label: 'Juin' },
  { value: 7, label: 'Juillet' },
  { value: 8, label: 'Août' },
  { value: 9, label: 'Septembre' },
  { value: 10, label: 'Octobre' },
  { value: 11, label: 'Novembre' },
  { value: 12, label: 'Décembre' },
]

const selectedMonth = ref(new Date().getMonth() + 1)

const selectedMonthLabel = computed(() => {
  const option = monthOptions.find((option) => option.value === selectedMonth.value)
  return option ? option.label : 'Tous les mois'
})

const filteredVentesByMonth = computed(() => {
  return props.ventesData.filter((vente) => {
    if (!vente.date_vente) {
      return false
    }
    const d = new Date(vente.date_vente)
    return d.getMonth() + 1 === selectedMonth.value
  })
})

const weekdaySalesChartData = computed(() => {
  const weekdays = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
  const totals = Array(7).fill(0)

  for (const vente of filteredVentesByMonth.value) {
    const d = new Date(vente.date_vente)
    const dayIndex = (d.getDay() + 6) % 7 // Convertir dimanche=0 en 6
    totals[dayIndex] += vente.total_montant || 0
  }

  return {
    labels: weekdays,
    datasets: [
      {
        label: `Montant des ventes en ${selectedMonthLabel.value}`,
        data: totals,
        backgroundColor: '#2563eb',
        borderRadius: 6,
      },
    ],
  }
})

const weekdaySalesChartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx) => `Montant: ${ctx.raw.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}`,
      },
    },
  },
  scales: {
    x: {
      ticks: { font: { size: 11 } },
    },
    y: {
      beginAtZero: true,
      ticks: {
        callback: (value) => value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }),
      },
    },
  },
}

const hourlySalesChartData = computed(() => {
  const hours = Array.from({ length: 24 }, (_, index) => `${String(index).padStart(2, '0')}h`)
  const totals = Array(24).fill(0)

  for (const vente of filteredVentesByMonth.value) {
    const dateSource = vente.created_at || (vente.date_vente ? `${vente.date_vente}T00:00:00` : null)
    if (!dateSource) continue

    const d = new Date(dateSource)
    const hour = d.getHours()
    totals[hour] += vente.total_montant || 0
  }

  return {
    labels: hours,
    datasets: [
      {
        label: `Montant des ventes en ${selectedMonthLabel.value}`,
        data: totals,
        backgroundColor: '#0284c7',
        borderRadius: 4,
      },
    ],
  }
})

const hourlySalesChartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx) => `Montant: ${ctx.raw.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}`,
      },
    },
  },
  scales: {
    x: {
      ticks: { font: { size: 10 }, maxRotation: 0, minRotation: 0 },
    },
    y: {
      beginAtZero: true,
      ticks: {
        callback: (value) => value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }),
      },
    },
  },
}

/**
 * Calculs pour l'évolution mensuelle des ventes.
 */
const monthlyChartData = computed(() => {
  const monthData = {}
  for (const vente of props.ventesData) {
    if (!vente.date_vente) continue
    const d = new Date(vente.date_vente)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!monthData[key]) {
      monthData[key] = { montant: 0, articles: 0, count: 0 }
    }
    monthData[key].montant += vente.total_montant || 0
    monthData[key].articles += vente.total_articles || 0
    monthData[key].count++
  }

  // Trier par date
  const sorted = Object.entries(monthData).sort(([a], [b]) => a.localeCompare(b))

  // Formater les labels en français
  const months = [
    'Jan',
    'Fév',
    'Mar',
    'Avr',
    'Mai',
    'Juin',
    'Juil',
    'Août',
    'Sep',
    'Oct',
    'Nov',
    'Déc',
  ]

  return {
    labels: sorted.map(([key]) => {
      const [, m] = key.split('-')
      return months[parseInt(m, 10) - 1]
    }),
    datasets: [
      {
        label: 'Montant (€)',
        data: sorted.map(([, data]) => data.montant),
        borderColor: '#059669',
        backgroundColor: 'rgba(5, 150, 105, 0.1)',
        fill: true,
        tension: 0.3,
        yAxisID: 'y',
      },
      {
        label: 'Nombre de ventes',
        data: sorted.map(([, data]) => data.count),
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        fill: true,
        tension: 0.3,
        yAxisID: 'y1',
      },
    ],
  }
})

const monthlyChartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  interaction: {
    mode: 'index',
    intersect: false,
  },
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        usePointStyle: true,
        padding: 16,
        font: { size: 12 },
      },
    },
    tooltip: {
      callbacks: {
        label: (ctx) => {
          if (ctx.datasetIndex === 0) {
            return `Montant: ${ctx.raw.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}`
          }
          return `Ventes: ${ctx.raw}`
        },
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      position: 'left',
      title: {
        display: true,
        text: 'Montant (€)',
        font: { size: 11 },
      },
      ticks: {
        callback: (value) => value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }),
      },
    },
    y1: {
      beginAtZero: true,
      position: 'right',
      grid: {
        drawOnChartArea: false,
      },
      title: {
        display: true,
        text: 'Nombre de ventes',
        font: { size: 11 },
      },
      ticks: {
        precision: 0,
      },
    },
  },
}

/**
 * Calculs pour la répartition par artisan (vue globale uniquement).
 */
const artisanChartData = computed(() => {
  if (!props.isGlobal || !props.groupesData.length) {
    return { labels: [], datasets: [{ data: [], backgroundColor: [] }] }
  }

  const colors = [
    '#4f46e5',
    '#059669',
    '#d97706',
    '#dc2626',
    '#7c3aed',
    '#0891b2',
    '#be185d',
    '#65a30d',
    '#ea580c',
    '#2563eb',
  ]

  return {
    labels: props.groupesData.map((g) => g.artisan_nom || 'Inconnu'),
    datasets: [
      {
        data: props.groupesData.map((g) => g.summary.total_montant),
        backgroundColor: props.groupesData.map((_, i) => colors[i % colors.length]),
        borderWidth: 2,
        borderColor: '#ffffff',
      },
    ],
  }
})

const artisanChartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        padding: 12,
        usePointStyle: true,
        font: { size: 11 },
      },
    },
    tooltip: {
      callbacks: {
        label: (ctx) => {
          const total = ctx.dataset.data.reduce((a, b) => a + b, 0)
          const value = ctx.raw
          const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0
          return `${ctx.label}: ${value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} (${pct}%)`
        },
      },
    },
  },
}
</script>

<style scoped>
.graphiques-container {
  margin-top: 32px;
  margin-bottom: 24px;
}

.section-title {
  font-size: 1.2rem;
  color: #1e293b;
  margin: 0 0 16px;
  padding-bottom: 8px;
  border-bottom: 2px solid #e2e8f0;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.chart-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.chart-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.chart-filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chart-month-select {
  min-width: 140px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px 10px;
  background: white;
  color: #0f172a;
}

.chart-card-wide {
  grid-column: 1 / -1;
}

.chart-title {
  font-size: 0.95rem;
  color: #374151;
  margin: 0 0 16px;
  font-weight: 600;
}

.chart-wrapper {
  position: relative;
  max-height: 300px;
  display: flex;
  justify-content: center;
}
</style>