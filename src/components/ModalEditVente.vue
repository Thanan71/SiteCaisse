<template>
  <VenteFormModal
    mode="edit"
    :show="show"
    :vente="vente"
    @close="$emit('close')"
    @saved="$emit('saved')"
  />
</template>

<script setup>
import VenteFormModal from './VenteFormModal.vue'

defineProps({
  show: Boolean,
  vente: Object
})

defineEmits(['close', 'saved'])
</script>
