<template>
  <div class="rapport-table-block">
    <h2 v-if="title" class="artisan-rapport-title">{{ title }}</h2>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Articles</th>
            <th>Total Qté</th>
            <th>Montant total</th>
            <th>Paiement</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="vente in ventes" :key="vente.id">
            <td>{{ formatDate(vente.date_vente) }}</td>
            <td class="articles-cell">
              <div
                v-for="(article, articleIndex) in getVisibleItems(vente.articles, vente.id)"
                :key="article.id || articleIndex"
                class="article-line"
              >
                <span class="article-name-sm">{{ article.article }} × {{ article.quantite }} &nbsp;</span>
                <span class="article-subtotal-sm">{{ formatPrice(article.prix * article.quantite) }}</span>
              </div>
              <button
                v-if="vente.articles && vente.articles.length > 1"
                class="btn-expand"
                @click="toggleExpanded(vente.id)"
              >
                {{ isExpanded(vente.id) ? '▲ Moins' : `▼ +${vente.articles.length - 1} autre(s)` }}
              </button>
            </td>
            <td class="text-center">{{ vente.total_articles }}</td>
            <td class="text-right total-price">{{ formatPrice(vente.total_montant) }}</td>
            <td>
              <PaymentBadge :type="vente.type_paiement" />
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="summary-row">
            <td colspan="2"><strong>{{ totalLabel }}</strong></td>
            <td class="text-center"><strong>{{ summary.total_articles }}</strong></td>
            <td class="text-right"><strong class="total-sum">{{ formatPrice(summary.total_montant) }}</strong></td>
            <td></td>
          </tr>
          <tr v-if="summary.commission_cb > 0" class="commission-row">
            <td colspan="4" class="text-right">
              <span class="commission-label">
                Commission CB ({{ summary.taux_commission }}% sur {{ formatPrice(summary.total_cb) }})
              </span>
            </td>
            <td class="text-right">
              <span class="commission-value">- {{ formatPrice(summary.commission_cb) }}</span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
</template>

<script setup>
import { useExpandableRows } from '../composables/useExpandableRows'
import { formatDate, formatPrice } from '../utils/formatters'
import PaymentBadge from './PaymentBadge.vue'

defineProps({
  ventes: {
    type: Array,
    default: () => []
  },
  summary: {
    type: Object,
    required: true
  },
  title: {
    type: String,
    default: ''
  },
  totalLabel: {
    type: String,
    default: 'TOTAL'
  }
})

const { getVisibleItems, isExpanded, toggleExpanded } = useExpandableRows()
</script>

<style scoped>
.rapport-table-block {
  margin-bottom: 32px;
}

.artisan-rapport-title {
  font-size: 1.15rem;
  color: #1e293b;
  margin: 0 0 12px;
  padding-bottom: 8px;
  border-bottom: 2px solid #e2e8f0;
}

tbody td {
  vertical-align: top;
}

tfoot td {
  padding: 16px;
  border-top: 2px solid #e2e8f0;
  font-size: 0.95rem;
}

.summary-row {
  background: #f8fafc;
}

.total-sum {
  color: #059669;
  font-size: 1.1rem;
}

.commission-row td {
  padding: 10px 16px;
  border-top: 1px dashed #e2e8f0;
  font-size: 0.85rem;
}

.commission-label {
  color: #64748b;
  font-size: 0.85rem;
}

.commission-value {
  color: #ef4444;
  font-weight: 600;
  font-size: 0.95rem;
}

.articles-cell {
  min-width: 220px;
}

.article-line {
  padding: 4px 0;
}

.article-line + .article-line {
  border-top: 1px dashed #e2e8f0;
  margin-top: 4px;
  padding-top: 8px;
}

.article-name-sm {
  font-weight: 600;
  font-size: 0.85rem;
  color: #1e293b;
}

.article-subtotal-sm {
  color: #059669;
  font-weight: 600;
  font-size: 0.85rem;
}

.total-price {
  font-weight: 600;
  color: #059669;
  white-space: nowrap;
}

.btn-expand {
  background: none;
  border: 1px solid #e2e8f0;
  color: #4f46e5;
  cursor: pointer;
  font-size: 0.75rem;
  padding: 3px 10px;
  border-radius: 6px;
  margin-top: 6px;
  transition: background 0.2s, border-color 0.2s;
}

.btn-expand:hover {
  background: #f1f5f9;
  border-color: #4f46e5;
}
</style>
