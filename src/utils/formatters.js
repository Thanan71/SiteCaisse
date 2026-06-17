const paymentLabels = {
  CB: 'Carte Bancaire',
  Espece: 'Espèce',
  Cheque: 'Chèque',
}

const monthLabels = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
]

export function formatDate(dateStr, fallback = '-') {
  if (!dateStr) return fallback
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Paris',
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
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  })
}

export function formatDateSimple(dateStr, fallback = '—') {
  if (!dateStr) return fallback
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

export function formatDateWithTime(dateStr, timestampStr, fallback = '-') {
  if (!dateStr) return fallback
  // Formatter la date
  const date = new Date(dateStr)
  const formattedDate = date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  })

  // Extraire l'heure du timestamp
  if (!timestampStr) return formattedDate
  const timestamp = new Date(timestampStr)
  const formattedTime = timestamp.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  })

  return `${formattedDate} ${formattedTime}`
}

export function formatPrice(price) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(price || 0)
}

export function getPaymentLabel(type) {
  return paymentLabels[type] || type
}

export function formatMonthLabel(monthStr) {
  if (!monthStr) return ''
  const [year, month] = monthStr.split('-')
  const monthIndex = parseInt(month, 10) - 1
  return `${monthLabels[monthIndex] || month} ${year}`
}
