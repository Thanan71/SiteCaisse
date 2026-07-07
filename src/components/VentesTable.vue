<template>
  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Articles</th>
          <th v-if="showArtisan">Artisan</th>
          <th>{{ quantityLabel }}</th>
          <th>Montant total</th>
          <th>Paiement</th>
          <th v-if="showVendeur">Vendeur</th>
          <th v-if="showActions">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="vente in ventes" :key="vente.id">
          <td>{{ formatDateWithTime(vente.date_vente, vente.created_at) }}</td>
          <td class="articles-cell">
            <div
              v-for="(article, articleIndex) in getVisibleItems(vente.articles, rowKey(vente))"
              :key="article.id || articleIndex"
              class="article-line"
            >
              <span :class="compactArticles ? 'article-name-sm' : 'article-name'">
                {{ article.article }}<span v-if="compactArticles"> × {{ article.quantite }} &nbsp;</span>
              </span>
              <span v-if="compactArticles" class="article-subtotal-sm">
                {{ formatPrice(article.prix * article.quantite) }}
              </span>
              <span v-else class="article-details">
                {{ article.quantite }} &times; {{ formatPrice(article.prix) }}
                <span class="article-subtotal">= {{ formatPrice(article.prix * article.quantite) }}</span>
              </span>
            </div>
            <button
              v-if="vente.articles && vente.articles.length > 1"
              class="btn-expand"
              @click="toggleExpanded(rowKey(vente))"
            >
              {{ isExpanded(rowKey(vente)) ? '▲ Moins' : `▼ +${vente.articles.length - 1} autre(s)` }}
            </button>
          </td>
          <td v-if="showArtisan">{{ getArtisansForVente(vente) }}</td>
          <td class="text-center">{{ vente.total_articles }}</td>
          <td class="text-right total-price">{{ formatPrice(vente.total_montant) }}</td>
          <td>
            <PaymentBadge :type="vente.type_paiement" />
          </td>
          <td v-if="showVendeur">{{ vente.vendeur_nom }}</td>
          <td v-if="showActions" class="actions-cell">
            <button class="btn-icon" title="Modifier" @click="$emit('edit', vente)">
              ✏️
            </button>
            <button class="btn-icon" title="Supprimer" @click="$emit('delete', vente.id)">
              🗑️
            </button>
          </td>
        </tr>
      </tbody>
      <tfoot v-if="summary">
        <tr class="summary-row">
          <td :colspan="summaryLabelColspan"><strong>{{ totalLabel }}</strong></td>
          <td class="text-center"><strong>{{ summary.total_articles }}</strong></td>
          <td class="text-right"><strong class="total-sum">{{ formatPrice(summary.total_montant) }}</strong></td>
          <td v-if="summaryTrailingColspan > 0" :colspan="summaryTrailingColspan"></td>
        </tr>
        <tr v-if="summary.commission_cb > 0" class="commission-row">
          <td :colspan="commissionLabelColspan" class="text-right">
            <span class="commission-label">
              {{ summary.commission_personnalisee ? 'Commission CB personnalisée' : 'Commission CB' }}
              ({{ summary.taux_commission }}% sur {{ formatPrice(summary.total_cb) }})
            </span>
          </td>
          <td class="text-right">
            <span class="commission-value">- {{ formatPrice(summary.commission_cb) }}</span>
          </td>
          <td v-if="commissionTrailingColspan > 0" :colspan="commissionTrailingColspan"></td>
        </tr>
      </tfoot>
    </table>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useExpandableRows } from '../composables/useExpandableRows'
import { useArtisansStore } from '../store/artisans'
import { formatDate, formatDateWithTime, formatPrice } from '../utils/formatters'
import PaymentBadge from './PaymentBadge.vue'

const props = defineProps({
  ventes: {
    type: Array,
    default: () => [],
  },
  summary: {
    type: Object,
    default: null,
  },
  totalLabel: {
    type: String,
    default: 'TOTAL',
  },
  rowKeyPrefix: {
    type: String,
    default: '',
  },
  showArtisan: {
    type: Boolean,
    default: false,
  },
  showVendeur: {
    type: Boolean,
    default: false,
  },
  showActions: {
    type: Boolean,
    default: false,
  },
  compactArticles: {
    type: Boolean,
    default: false,
  },
  quantityLabel: {
    type: String,
    default: 'Total articles',
  },
})

defineEmits(['edit', 'delete'])

const { getVisibleItems, isExpanded, toggleExpanded } = useExpandableRows()

const artisansStore = useArtisansStore()

onMounted(() => {
  if (!artisansStore.artisans || artisansStore.artisans.length === 0) {
    artisansStore.fetchArtisans().catch(() => {})
  }
})

function getArtisansForVente(vente) {
  const artisans = []

  if (vente.articles?.length) {
    for (const art of vente.articles) {
      const aid = art.artisan_id || null
      const name = artisansStore.getArtisanName(Number(aid))
      if (name && name !== 'Artisan inconnu' && !artisans.includes(name)) artisans.push(name)
    }
  }

  if (artisans.length) return artisans.join(', ')
  return artisansStore.getArtisanName(null)
}

const columnCount = computed(() => {
  let count = 5
  if (props.showArtisan) count += 1
  if (props.showVendeur) count += 1
  if (props.showActions) count += 1
  return count
})

const summaryLabelColspan = computed(() => {
  let count = 2
  if (props.showArtisan) count += 1
  return count
})

const summaryTrailingColspan = computed(() =>
  Math.max(0, columnCount.value - summaryLabelColspan.value - 2),
)
const commissionLabelColspan = computed(() => Math.max(1, columnCount.value - 1))
const commissionTrailingColspan = computed(() =>
  Math.max(0, columnCount.value - commissionLabelColspan.value - 1),
)

function rowKey(vente) {
  return `${props.rowKeyPrefix}${vente.id}`
}
</script>

<style scoped>
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
  display: flex;
  flex-direction: column;
  padding: 4px 0;
}

.article-line + .article-line {
  border-top: 1px dashed #e2e8f0;
  margin-top: 4px;
  padding-top: 8px;
}

.article-name,
.article-name-sm {
  font-weight: 600;
  color: #1e293b;
}

.article-name {
  font-size: 0.9rem;
}

.article-name-sm,
.article-subtotal-sm {
  font-size: 0.85rem;
}

.article-details {
  font-size: 0.8rem;
  color: #64748b;
  margin-top: 2px;
}

.article-subtotal,
.article-subtotal-sm {
  font-weight: 600;
  color: #059669;
}

.total-price {
  font-weight: 600;
  color: #059669;
  white-space: nowrap;
}

.actions-cell {
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

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.2s;
}

.btn-icon:hover {
  background: #f1f5f9;
}
</style>
