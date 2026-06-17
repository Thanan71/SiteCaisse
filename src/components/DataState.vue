<template>
  <div v-if="loading" class="loading-state">
    <div class="spinner"></div>
    <p>{{ loadingText }}</p>
  </div>

  <div v-else-if="error" class="error-state">
    <p>{{ error }}</p>
    <button v-if="onRetry" class="btn btn-secondary" @click="onRetry">Réessayer</button>
  </div>

  <div v-else-if="empty" class="empty-state">
    <div class="empty-icon">{{ emptyIcon }}</div>
    <h3>{{ emptyTitle }}</h3>
    <p>{{ emptyMessage }}</p>
    <slot name="empty-actions" />
  </div>

  <div v-else>
    <slot />
  </div>
</template>

<script setup>
defineProps({
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  empty: { type: Boolean, default: false },
  emptyIcon: { type: String, default: '📋' },
  emptyTitle: { type: String, default: 'Aucune donnée' },
  emptyMessage: { type: String, default: '' },
  loadingText: { type: String, default: 'Chargement...' },
  onRetry: { type: Function, default: null },
})
</script>

<style scoped>
.empty-state {
  text-align: center;
  padding: 60px 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 16px;
}

.empty-state h3 {
  margin: 0 0 8px;
  color: #1e293b;
}

.empty-state p {
  color: #64748b;
  margin: 0 0 16px;
}
</style>