/**
 * @module loggerService
 * @description Journalisation des actions utilisateur en base de données.
 */
'use strict'

const { getSupabase } = require('../db.cjs')

/**
 * Journalise une action sans bloquer le flux métier si l'insertion échoue.
 * @param {Object} params - Données de journalisation.
 * @param {Object|null} [params.user] - Utilisateur connecté.
 * @param {string} params.action - Action réalisée.
 * @param {string} [params.cible_type] - Type de ressource concernée.
 * @param {number|string|null} [params.cible_id] - Identifiant de la ressource.
 * @param {Object} [params.details] - Détails complémentaires, sans données sensibles.
 * @param {import('express').Request} [params.req] - Requête Express.
 * @returns {Promise<void>}
 */
async function logAction({
  user = null,
  action,
  cible_type = null,
  cible_id = null,
  details = {},
  req = null,
}) {
  if (!action) return

  try {
    const supabase = getSupabase()
    const payload = {
      user_id: user?.id || null,
      user_nom: user?.nom || null,
      user_email: user?.email || null,
      action,
      cible_type,
      cible_id: cible_id === undefined || cible_id === null ? null : String(cible_id),
      details,
      ip_address: getRequestIp(req),
      user_agent: req?.headers?.['user-agent'] || null,
    }

    const { error } = await supabase.from('action_logs').insert(payload)
    if (error) {
      console.error('Logger insert error:', error.message)
    }
  } catch (err) {
    console.error('Logger service error:', err)
  }
}

/**
 * Journalise une erreur applicative.
 * @param {Object} params - Données de journalisation.
 * @param {Object|null} [params.user] - Utilisateur connecté.
 * @param {Error|Object|string} params.err - Erreur capturée.
 * @param {string} params.context - Contexte fonctionnel de l'erreur.
 * @param {string} [params.cible_type] - Type de ressource concernée.
 * @param {number|string|null} [params.cible_id] - Identifiant de la ressource.
 * @param {Object} [params.details] - Détails complémentaires.
 * @param {import('express').Request} [params.req] - Requête Express.
 * @returns {Promise<void>}
 */
async function logError({
  user = null,
  err,
  context,
  cible_type = 'error',
  cible_id = null,
  details = {},
  req = null,
}) {
  const safeError = formatError(err)

  await logAction({
    user,
    action: 'error',
    cible_type,
    cible_id,
    details: {
      context,
      method: req?.method || null,
      path: req?.originalUrl || req?.url || null,
      ...safeError,
      ...details,
    },
    req,
  })
}

/**
 * Récupère les logs avec pagination et filtres.
 * @param {Object} [options] - Options de récupération.
 * @param {number|string} [options.page=1] - Page demandée.
 * @param {number|string} [options.limit=25] - Nombre de lignes par page.
 * @param {string} [options.action] - Filtre action.
 * @param {string} [options.cible_type] - Filtre type de cible.
 * @returns {Promise<{logs: Array, pagination: Object}>}
 */
async function getActionLogs(options = {}) {
  const supabase = getSupabase()
  const rawPage = parseInt(options.page, 10)
  const rawLimit = parseInt(options.limit, 10)
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 25
  const offset = (page - 1) * limit

  let countQuery = supabase.from('action_logs').select('*', { count: 'exact', head: true })
  let logsQuery = supabase
    .from('action_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1)

  if (options.action) {
    countQuery = countQuery.eq('action', options.action)
    logsQuery = logsQuery.eq('action', options.action)
  }

  if (options.cible_type) {
    countQuery = countQuery.eq('cible_type', options.cible_type)
    logsQuery = logsQuery.eq('cible_type', options.cible_type)
  }

  const { count, error: countError } = await countQuery
  if (countError) throw countError

  const { data, error } = await logsQuery
  if (error) throw error

  return {
    logs: data || [],
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  }
}

function getRequestIp(req) {
  if (!req) return null
  const forwarded = req.headers?.['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim()
  }
  return req.ip || req.socket?.remoteAddress || null
}

function formatError(err) {
  if (!err) {
    return { message: 'Erreur inconnue' }
  }

  if (typeof err === 'string') {
    return { message: err }
  }

  return {
    name: err.name || null,
    message: err.message || 'Erreur inconnue',
    code: err.code || null,
    status: err.status || err.statusCode || null,
  }
}

module.exports = {
  logAction,
  logError,
  getActionLogs,
}
