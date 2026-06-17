<template>
  <div v-if="show" class="modal-overlay" @click.self="onCancel">
    <div class="modal-content" :class="variant ? `modal-${variant}` : ''">
      <h3>{{ title }}</h3>
      <p>{{ message }}</p>
      <p v-if="warning" class="warning-text">{{ warning }}</p>
      <slot />
      <div class="modal-actions">
        <button @click="onCancel" class="btn btn-secondary" :disabled="loading">
          {{ cancelText }}
        </button>
        <button
          @click="$emit('confirm')"
          class="btn"
          :class="confirmClass"
          :disabled="loading"
        >
          {{ loading ? loadingText : confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  show: { type: Boolean, required: true },
  title: { type: String, default: 'Confirmer' },
  message: { type: String, default: 'Êtes-vous sûr ?' },
  warning: { type: String, default: '' },
  confirmText: { type: String, default: 'Confirmer' },
  cancelText: { type: String, default: 'Annuler' },
  loading: { type: Boolean, default: false },
  loadingText: { type: String, default: 'Chargement...' },
  variant: {
    type: String,
    default: '',
    validator: (value) => ['', 'danger', 'warning'].includes(value),
  },
})

const emit = defineEmits(['confirm', 'cancel'])

const confirmClass = computed(() => {
  if (props.variant === 'danger') return 'btn-danger'
  if (props.variant === 'warning') return 'btn-warning'
  return 'btn-primary'
})

function onCancel() {
  if (!props.loading) {
    emit('cancel')
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  padding: 28px;
  max-width: 460px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-content h3 {
  margin: 0 0 12px 0;
  font-size: 1.15rem;
  color: #1e293b;
}

.modal-content p {
  margin: 0 0 8px 0;
  color: #475569;
  font-size: 0.9rem;
  line-height: 1.5;
}

.warning-text {
  color: #ef4444 !important;
  font-size: 0.85rem !important;
  background: #fef2f2;
  padding: 10px 12px;
  border-radius: 8px;
  margin-bottom: 20px !important;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 8px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #4f46e5;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #4338ca;
}

.btn-secondary {
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
}

.btn-secondary:hover:not(:disabled) {
  background: #e2e8f0;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #dc2626;
}

.btn-warning {
  background: #f59e0b;
  color: white;
}

.btn-warning:hover:not(:disabled) {
  background: #d97706;
}
</style>