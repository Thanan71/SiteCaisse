<template>
  <div class="month-selector-card">
    <div class="month-selector-row">
      <label for="month-select">Sélectionner un mois :</label>
      <input
        :id="inputId"
        type="month"
        :value="modelValue"
        @input="$emit('update:modelValue', $event.target.value)"
        @change="$emit('change', modelValue)"
        class="month-input"
      />
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup>
defineProps({
  modelValue: { type: String, required: true },
  inputId: { type: String, default: 'month-select' },
})

defineEmits(['update:modelValue', 'change'])
</script>

<style scoped>
.month-selector-card {
  background: white;
  border-radius: 12px;
  padding: 20px 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  margin-bottom: 24px;
}

.month-selector-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.month-selector-row label {
  font-weight: 600;
  font-size: 0.85rem;
  color: #374151;
  white-space: nowrap;
}

.month-input {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.9rem;
  background: white;
  transition: border-color 0.2s;
}

.month-input:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}
</style>