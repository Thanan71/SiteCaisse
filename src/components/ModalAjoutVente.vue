<template>
  <VenteFormModal mode="create" :show="show" @close="$emit('close')" />
</template>

<script setup>
import VenteFormModal from './VenteFormModal.vue'

defineProps({
  show: Boolean
})

defineEmits(['close'])
</script>
