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
  const date = parseUtcDate(dateStr)
  if (!date) return fallback
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  })
}

export function formatDateTime(dateStr, fallback = '—') {
  if (!dateStr) return fallback
  const date = parseUtcDate(dateStr)
  if (!date) return fallback
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

/**
 * Convertit une chaîne ISO (potentiellement sans timezone) en objet Date UTC.
 * Si la chaîne n'a pas de timezone explicite, on force UTC pour éviter
 * que JS interprète l'heure comme locale (ce qui décale tout).
 */
export function parseUtcDate(str) {
  if (!str) return null

  const value = String(str).trim()
  if (!value) return null

  let normalized = value

  // Les champs SQL DATE arrivent sous la forme YYYY-MM-DD.
  // Ajouter uniquement "Z" produit YYYY-MM-DDZ, format non standard rejeté par Safari.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    normalized = `${value}T00:00:00Z`
  } else if (!/[Zz]$/.test(value) && !/[+-]\d{2}:\d{2}$/.test(value)) {
    // Timestamp ISO sans timezone : conserver le comportement historique en le traitant comme UTC.
    normalized = `${value}Z`
  }

  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDateWithTime(dateStr, timestampStr, fallback = '-') {
  if (!dateStr) return fallback
  // Formatter la date seule (toujours sans heure, on parse en UTC)
  const date = parseUtcDate(dateStr)
  if (!date) return fallback
  const formattedDate = date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  })

  // Extraire l'heure du timestamp (created_at)
  if (!timestampStr) return formattedDate
  const timestamp = parseUtcDate(timestampStr)
  if (!timestamp) return formattedDate
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
