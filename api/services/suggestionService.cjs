'use strict'

const { getSupabase } = require('../db.cjs')

const SUGGESTION_COLUMNS =
  'id, titre, description, statut, auteur_id, auteur_nom, auteur_nom_boutique, created_at, updated_at'
const STATUTS = new Set(['nouvelle', 'en_cours', 'acceptee', 'refusee', 'terminee'])
const parisOffsetFormatter = new Intl.DateTimeFormat('en', {
  timeZone: 'Europe/Paris',
  timeZoneName: 'longOffset',
})

class SuggestionError extends Error {
  constructor(message, statusCode = 400) {
    super(message)
    this.name = 'SuggestionError'
    this.statusCode = statusCode
  }
}

function validateText(value, label, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw new SuggestionError(`${label} doit contenir entre 1 et ${maxLength} caractères`)
  }
  return value.trim()
}

function validateStatus(value) {
  if (typeof value !== 'string' || !STATUTS.has(value.trim())) {
    throw new SuggestionError('Statut de suggestion invalide')
  }
  return value.trim()
}

function positiveInteger(value, label, fallback, max = Number.MAX_SAFE_INTEGER) {
  if (value === undefined && fallback !== undefined) return fallback
  const validType =
    typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value.trim()))
  const number = validType ? Number(value) : NaN
  if (!Number.isSafeInteger(number) || number < 1 || number > max) {
    throw new SuggestionError(`${label} invalide`)
  }
  return number
}

function validateDate(value, label) {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) {
    throw new SuggestionError(`${label} invalide. Utilisez YYYY-MM-DD`)
  }
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new SuggestionError(`${label} invalide. Utilisez YYYY-MM-DD`)
  }
  return date
}

// La date validée représente un jour civil, affiché en Europe/Paris dans l'interface.
function startOfParisDay(date) {
  const civilMidnight = date.getTime()
  let utcMidnight = civilMidnight
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const offsetName = parisOffsetFormatter
      .formatToParts(new Date(utcMidnight))
      .find((part) => part.type === 'timeZoneName').value
    const match = /^GMT([+-])(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(offsetName)
    const offsetSeconds = match
      ? (Number(match[2]) * 3600 + Number(match[3]) * 60 + Number(match[4] || 0)) *
        (match[1] === '+' ? 1 : -1)
      : 0
    const correctedMidnight = civilMidnight - offsetSeconds * 1000
    if (correctedMidnight === utcMidnight) break
    utcMidnight = correctedMidnight
  }
  return new Date(utcMidnight)
}

async function createSuggestion(body, auteur) {
  const titre = validateText(body?.titre, 'Le titre', 120)
  const description = validateText(body?.description, 'La description', 2000)
  const { data, error } = await getSupabase()
    .from('suggestions')
    .insert({
      titre,
      description,
      statut: 'nouvelle',
      auteur_id: auteur.id,
      auteur_nom: auteur.nom,
      auteur_nom_boutique: auteur.nom_boutique || null,
    })
    .select(SUGGESTION_COLUMNS)
    .single()
  if (error) throw error
  return data
}

async function querySuggestions(options, auteurId) {
  const page = positiveInteger(options.page, 'Page', 1)
  const limit = positiveInteger(options.limit, 'Limite', 20, 100)
  const offset = (page - 1) * limit
  if (!Number.isSafeInteger(offset + limit - 1)) {
    throw new SuggestionError('Page invalide')
  }
  const statut = options.statut === undefined ? undefined : validateStatus(options.statut)
  const dateDebut = validateDate(options.date_debut, 'Date de début')
  const dateFin = validateDate(options.date_fin, 'Date de fin')
  if (dateDebut && dateFin && dateDebut > dateFin) {
    throw new SuggestionError('La date de début doit précéder la date de fin')
  }
  const ordre = options.ordre === undefined ? 'desc' : options.ordre
  if (ordre !== 'asc' && ordre !== 'desc') throw new SuggestionError('Ordre invalide')
  const ascending = ordre === 'asc'

  let query = getSupabase().from('suggestions').select(SUGGESTION_COLUMNS, { count: 'exact' })
  if (auteurId !== undefined) query = query.eq('auteur_id', auteurId)
  if (statut !== undefined) query = query.eq('statut', statut)
  if (dateDebut) query = query.gte('created_at', startOfParisDay(dateDebut).toISOString())
  if (dateFin) {
    // Le lendemain civil à Paris inclut toute la journée, même si elle dure 23 h ou 25 h.
    dateFin.setUTCDate(dateFin.getUTCDate() + 1)
    query = query.lt('created_at', startOfParisDay(dateFin).toISOString())
  }
  const { data, count, error } = await query
    .order('created_at', { ascending })
    .order('id', { ascending })
    .range(offset, offset + limit - 1)
  if (error) throw error
  return { suggestions: data || [], total: count || 0, page, limit }
}

function listSuggestions(options = {}) {
  return querySuggestions(options)
}

async function listOwnSuggestions(rawAuteurId, options = {}) {
  const auteurId = positiveInteger(rawAuteurId, 'ID auteur', undefined, 2147483647)
  return querySuggestions(options, auteurId)
}

async function updateSuggestionStatus(rawId, statut) {
  const id = positiveInteger(rawId, 'ID de suggestion', undefined, 2147483647)
  const validatedStatus = validateStatus(statut)
  const { data, error } = await getSupabase()
    .from('suggestions')
    .update({ statut: validatedStatus, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(SUGGESTION_COLUMNS)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new SuggestionError('Suggestion introuvable', 404)
  return data
}

module.exports = {
  SuggestionError,
  createSuggestion,
  listSuggestions,
  listOwnSuggestions,
  updateSuggestionStatus,
}
