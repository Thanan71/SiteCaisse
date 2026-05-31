const paymentLabels = {
  CB: 'Carte Bancaire',
  Espece: 'Espèce',
  Cheque: 'Chèque'
}

export function formatDate(dateStr, fallback = '-') {
  if (!dateStr) return fallback
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

export function formatDateTime(dateStr, fallback = '—') {
  if (!dateStr) return fallback
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatDateSimple(dateStr, fallback = '—') {
  if (!dateStr) return fallback
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

export function formatPrice(price) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR'
  }).format(price || 0)
}

export function getPaymentLabel(type) {
  return paymentLabels[type] || type
}
