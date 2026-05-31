<template>
  <span class="payment-badge" :class="'payment-' + type.toLowerCase()">
    {{ getPaymentLabel(type) }}
  </span>
</template>

<script setup>
import { getPaymentLabel } from '../utils/formatters'

defineProps({
  type: {
    type: String,
    required: true
  }
})
</script>

<style scoped>
.payment-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
}

.payment-cb {
  background: #dbeafe;
  color: #2563eb;
}

.payment-espece {
  background: #d1fae5;
  color: #059669;
}

.payment-cheque {
  background: #fef3c7;
  color: #d97706;
}
</style>
