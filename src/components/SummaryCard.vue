<template>
  <div class="global-summary-card" :class="[variantClass]">
    <h3>{{ title }}</h3>
    <div class="global-summary-stats">
      <div class="stat">
        <span class="stat-label">Total articles</span>
        <span class="stat-value">{{ totalArticles }}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Total montant</span>
        <span class="stat-value stat-value-amount">{{ formatPrice(totalMontant) }}</span>
      </div>
      <div v-if="totalCb > 0" class="stat">
        <span class="stat-label">Total CB</span>
        <span class="stat-value stat-value-cb">{{ formatPrice(totalCb) }}</span>
      </div>
      <div v-if="totalCommission > 0" class="stat">
        <span class="stat-label">Commission CB{{ commissionLabelSuffix }}</span>
        <span class="stat-value stat-value-commission">{{ formatPrice(totalCommission) }}</span>
      </div>
    </div>
    <div v-if="commissionDetail" class="commission-detail">
      <span>{{ commissionDetail }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatPrice } from '../utils/formatters'

const props = defineProps({
  title: { type: String, required: true },
  totalArticles: { type: Number, default: 0 },
  totalMontant: { type: Number, default: 0 },
  totalCb: { type: Number, default: 0 },
  totalCommission: { type: Number, default: 0 },
  commissionDetail: { type: String, default: '' },
  commissionLabelSuffix: { type: String, default: '' },
  variant: {
    type: String,
    default: 'primary',
    validator: (v) => ['primary', 'warning', 'success'].includes(v),
  },
})

const variantClass = computed(() => {
  const map = { primary: 'summary-primary', warning: 'summary-warning', success: 'summary-success' }
  return map[props.variant] || 'summary-primary'
})
</script>

<style scoped>
.global-summary-card {
  background: white;
  border-radius: 12px;
  padding: 20px 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  margin-bottom: 24px;
  border: 2px solid #4f46e5;
}

.global-summary-card.summary-warning {
  border-color: #f59e0b;
}

.global-summary-card.summary-success {
  border-color: #059669;
}

.global-summary-card h3 {
  margin: 0 0 16px;
  font-size: 1.1rem;
  color: #1e293b;
}

.global-summary-stats {
  display: flex;
  gap: 40px;
  flex-wrap: wrap;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 0.85rem;
  color: #64748b;
  font-weight: 500;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1e293b;
}

.stat-value-amount {
  color: #059669;
}

.stat-value-cb {
  color: #2563eb;
}

.stat-value-commission {
  color: #ef4444;
}

.commission-detail {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
  font-size: 0.8rem;
  color: #64748b;
}
</style>