<template>
  <div class="rapport-table-block">
    <h2 v-if="title" class="artisan-rapport-title">{{ title }}</h2>
    <VentesTable
      :ventes="ventes"
      :summary="summary"
      :total-label="totalLabel"
      quantity-label="Total Qté"
      compact-articles
    />
  </div>
</template>

<script setup>
import VentesTable from './VentesTable.vue'

defineProps({
  ventes: {
    type: Array,
    default: () => [],
  },
  summary: {
    type: Object,
    required: true,
  },
  title: {
    type: String,
    default: '',
  },
  totalLabel: {
    type: String,
    default: 'TOTAL',
  },
})
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
</style>
