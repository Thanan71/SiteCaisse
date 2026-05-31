import { ref } from 'vue'

export function useExpandableRows() {
  const expandedRows = ref({})

  function getVisibleItems(items, key) {
    if (!items) return []
    if (items.length <= 1 || expandedRows.value[key]) return items
    return [items[0]]
  }

  function isExpanded(key) {
    return !!expandedRows.value[key]
  }

  function toggleExpanded(key) {
    expandedRows.value[key] = !expandedRows.value[key]
  }

  return {
    expandedRows,
    getVisibleItems,
    isExpanded,
    toggleExpanded,
  }
}
