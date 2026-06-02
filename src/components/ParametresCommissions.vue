<template>
  <div>
    <h2>Paramètres des commissions CB</h2>
    <p class="parametres-info">
      Les commissions CB sont calculées en pourcentage du montant total des ventes par carte bancaire.
    </p>
    <form @submit.prevent="$emit('save')" class="parametres-form">
      <div class="form-row">
        <div class="form-group">
          <label for="commission-permanent">Commission CB - Artisans permanents (%)</label>
          <div class="input-with-suffix">
            <input
              id="commission-permanent"
              :value="commissionPermanent"
              @input="$emit('update:commission-permanent', $event.target.value)"
              type="number"
              step="0.01"
              min="0"
              max="100"
              placeholder="1.70"
              required
            />
            <span class="input-suffix">%</span>
          </div>
        </div>
        <div class="form-group">
          <label for="commission-temporaire">Commission CB - Artisans temporaires (%)</label>
          <div class="input-with-suffix">
            <input
              id="commission-temporaire"
              :value="commissionTemporaire"
              @input="$emit('update:commission-temporaire', $event.target.value)"
              type="number"
              step="0.01"
              min="0"
              max="100"
              placeholder="1.70"
              required
            />
            <span class="input-suffix">%</span>
          </div>
        </div>
      </div>
      <button type="submit" class="btn btn-primary" :disabled="saving">
        {{ saving ? 'Enregistrement...' : 'Enregistrer les commissions' }}
      </button>
      <p v-if="error" class="error-message">{{ error }}</p>
      <p v-if="success" class="success-message">{{ success }}</p>
    </form>
  </div>
</template>

<script setup>
defineProps({
  commissionPermanent: { type: String, required: true },
  commissionTemporaire: { type: String, required: true },
  saving: { type: Boolean, default: false },
  error: { type: String, default: '' },
  success: { type: String, default: '' },
})

defineEmits(['save', 'update:commission-permanent', 'update:commission-temporaire'])
</script>

<style scoped>
.parametres-info {
  color: #64748b;
  font-size: 0.85rem;
  margin: -12px 0 16px 0;
  line-height: 1.5;
}

.parametres-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 0.85rem;
  font-weight: 500;
  color: #475569;
}

.input-with-suffix {
  position: relative;
  display: flex;
  align-items: center;
}

.input-with-suffix input {
  width: 100%;
  padding: 10px 36px 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.9rem;
  color: #1e293b;
  background: white;
  transition: border-color 0.2s;
}

.input-with-suffix input:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

.input-suffix {
  position: absolute;
  right: 12px;
  color: #64748b;
  font-weight: 500;
  pointer-events: none;
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
  align-self: flex-start;
}

.btn-primary:hover:not(:disabled) {
  background: #4338ca;
}

.error-message {
  color: #ef4444;
  font-size: 0.85rem;
  margin: 0;
}

.success-message {
  color: #22c55e;
  font-size: 0.85rem;
  margin: 0;
}

@media (max-width: 640px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>