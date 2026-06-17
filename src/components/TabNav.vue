<template>
  <div class="sub-nav">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      class="sub-nav-btn"
      :class="{ active: modelValue === tab.key }"
      @click="$emit('update:modelValue', tab.key); $emit('change', tab.key)"
    >
      {{ tab.icon ? tab.icon + ' ' : '' }}{{ tab.label }}
    </button>
  </div>
</template>

<script setup>
defineProps({
  tabs: {
    type: Array,
    required: true,
    validator: (tabs) => tabs.every((t) => t.key && t.label),
  },
  modelValue: { type: String, required: true },
})

defineEmits(['update:modelValue', 'change'])
</script>

<style scoped>
.sub-nav {
  display: flex;
  gap: 4px;
  margin-bottom: 24px;
  background: white;
  border-radius: 12px;
  padding: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.sub-nav-btn {
  flex: 1;
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  background: transparent;
  color: #64748b;
  transition: all 0.2s;
}

.sub-nav-btn:hover {
  background: #f1f5f9;
  color: #475569;
}

.sub-nav-btn.active {
  background: #4f46e5;
  color: white;
}
</style>