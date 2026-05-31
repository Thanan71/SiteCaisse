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

      <!-- Graphique : Top articles vendus -->
      <div class="chart-card">
        <h3 class="chart-title">Top articles les plus vendus</h3>
        <div class="chart-wrapper">
          <Bar :data="topArticlesChartData" :options="topArticlesChartOptions" />
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
import { computed, watch } from 'vue'
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

/**
 * Calculs pour le top articles vendus.
 */
const topArticlesChartData = computed(() => {
  const articleCounts = {}
  for (const art of allArticles.value) {
    const name = art.article
    if (!articleCounts[name]) {
      articleCounts[name] = { quantite: 0, montant: 0 }
    }
    articleCounts[name].quantite += art.quantite || 0
    articleCounts[name].montant += (art.prix || 0) * (art.quantite || 0)
  }

  // Trier par quantité décroissante et prendre les 10 premiers
  const top = Object.entries(articleCounts)
    .sort((a, b) => b[1].quantite - a[1].quantite)
    .slice(0, 10)

  return {
    labels: top.map(([name]) => (name.length > 18 ? `${name.substring(0, 16)}…` : name)),
    datasets: [
      {
        label: 'Quantité vendue',
        data: top.map(([, data]) => data.quantite),
        backgroundColor: '#4f46e5',
        borderRadius: 4,
      },
    ],
  }
})

const topArticlesChartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  indexAxis: 'y',
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        afterLabel: (ctx) => {
          const entry = Object.entries(articleCounts)[ctx.dataIndex]
          if (entry) {
            return `Montant: ${entry[1].montant.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}`
          }
          return ''
        },
      },
    },
  },
  scales: {
    x: {
      beginAtZero: true,
      ticks: {
        precision: 0,
        font: { size: 11 },
      },
    },
    y: {
      ticks: {
        font: { size: 10 },
      },
    },
  },
}

// Stockage temporaire pour le tooltip
const articleCounts = {}

// Mettre à jour articleCounts pour le tooltip
watch(
  allArticles,
  (articles) => {
    for (const art of articles) {
      const name = art.article
      if (!articleCounts[name]) {
        articleCounts[name] = { quantite: 0, montant: 0 }
      }
      articleCounts[name].quantite += art.quantite || 0
      articleCounts[name].montant += (art.prix || 0) * (art.quantite || 0)
    }
  },
  { immediate: true },
)

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