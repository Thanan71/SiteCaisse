/**
 * @module adminUserService
 * @description Cas d'usage administrateur liés aux utilisateurs.
 */
'use strict'

const bcrypt = require('bcryptjs')
const crypto = require('node:crypto')
const { getSupabase } = require('../db.cjs')
const { extendUserDateFin, resetUserPassword } = require('../models.cjs')

const USER_LIST_SELECT =
  'id, nom, nom_boutique, generated_password, commission_cb_personnalisee, role, est_actif, date_fin, created_at'

class AdminUserError extends Error {
  constructor(message, statusCode, code) {
    super(message)
    this.name = 'AdminUserError'
    this.statusCode = statusCode
    this.code = code
  }
}

function normalizePasswordBase(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function generateUserPassword(nomBoutique) {
  const base = normalizePasswordBase(nomBoutique) || 'boutique'
  const suffix = crypto.randomInt(0, 10000).toString().padStart(4, '0')
  return `${base}${suffix}`
}

function parseOptionalPositiveNumber(value) {
  if (value === undefined || value === null) return null

  const normalized = typeof value === 'string' ? value.trim().replace(',', '.') : value
  if (normalized === '') return null

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new AdminUserError(
      'La commission personnalisée doit être un nombre positif',
      400,
      'INVALID_COMMISSION',
    )
  }

  return parsed
}

async function findUserById(userId, select) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('users').select(select).eq('id', userId).maybeSingle()
  if (error) throw error
  return data || null
}

async function listUsers() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('users')
    .select(USER_LIST_SELECT)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

async function createUser({ nom, nom_boutique, role, date_fin }) {
  const supabase = getSupabase()

  const { data: existing, error: existingError } = await supabase
    .from('users')
    .select('id')
    .eq('nom_boutique', nom_boutique)
    .maybeSingle()

  if (existingError) throw existingError
  if (existing) {
    throw new AdminUserError(
      'Un utilisateur avec ce nom de boutique existe déjà',
      409,
      'DUPLICATE_SHOP',
    )
  }

  const generatedPassword = generateUserPassword(nom_boutique)
  const userData = {
    nom,
    nom_boutique,
    password_hash: bcrypt.hashSync(generatedPassword, 10),
    generated_password: generatedPassword,
    role,
    password_change_required: true,
  }

  if (date_fin) {
    userData.date_fin = date_fin
  }

  const { data, error } = await supabase
    .from('users')
    .insert(userData)
    .select(
      'id, nom, nom_boutique, generated_password, role, est_actif, date_fin, created_at, password_change_required',
    )
    .single()

  if (error) throw error
  return { user: data, newPassword: generatedPassword }
}

async function deleteUser(userId, currentUserId) {
  if (Number(userId) === Number(currentUserId)) {
    throw new AdminUserError('Vous ne pouvez pas supprimer votre propre compte', 400, 'SELF_DELETE')
  }

  const supabase = getSupabase()
  const userToDelete = await findUserById(userId, 'id, nom, nom_boutique, role')

  if (!userToDelete) {
    throw new AdminUserError('Utilisateur non trouvé', 404, 'USER_NOT_FOUND')
  }

  // Les FK en base détachent les ventes via ON DELETE SET NULL pour conserver l'historique.
  const { error } = await supabase.from('users').delete().eq('id', userId)
  if (error) throw error

  return userToDelete
}

async function updateUserCommission(userId, value) {
  const commissionCbPersonnalisee = parseOptionalPositiveNumber(value)
  const supabase = getSupabase()
  const user = await findUserById(
    userId,
    'id, nom, nom_boutique, role, commission_cb_personnalisee',
  )

  if (!user) {
    throw new AdminUserError('Utilisateur non trouvé', 404, 'USER_NOT_FOUND')
  }

  if (user.role === 'admin') {
    throw new AdminUserError(
      'Les commissions personnalisées ne concernent que les artisans',
      400,
      'ADMIN_COMMISSION',
    )
  }

  const { data, error } = await supabase
    .from('users')
    .update({ commission_cb_personnalisee: commissionCbPersonnalisee })
    .eq('id', userId)
    .select('id, nom, nom_boutique, role, commission_cb_personnalisee')
    .single()

  if (error) throw error

  return { previousUser: user, user: data }
}

async function resetPasswordForUser(userId) {
  const user = await findUserById(userId, 'id, nom, nom_boutique')

  if (!user) {
    throw new AdminUserError('Utilisateur non trouvé', 404, 'USER_NOT_FOUND')
  }

  const newPassword = await resetUserPassword(userId, generateUserPassword(user.nom_boutique))
  return { user, newPassword }
}

async function extendTemporaryUserAccess(userId, dateFin) {
  if (!dateFin) {
    throw new AdminUserError('La nouvelle date de fin est requise', 400, 'MISSING_END_DATE')
  }

  const user = await findUserById(userId, 'id, nom, nom_boutique, role, date_fin')

  if (!user) {
    throw new AdminUserError('Utilisateur non trouvé', 404, 'USER_NOT_FOUND')
  }

  if (user.role !== 'temporaire') {
    throw new AdminUserError(
      'Seuls les utilisateurs temporaires peuvent être prolongés',
      400,
      'NOT_TEMPORARY',
    )
  }

  const oldDate = new Date(user.date_fin)
  const newDate = new Date(dateFin)
  if (newDate <= oldDate) {
    throw new AdminUserError(
      'La nouvelle date de fin doit être postérieure à la date actuelle',
      400,
      'END_DATE_NOT_AFTER_CURRENT',
    )
  }

  await extendUserDateFin(userId, dateFin)
  return { user, nouvelleDateFin: dateFin }
}

module.exports = {
  AdminUserError,
  createUser,
  deleteUser,
  extendTemporaryUserAccess,
  listUsers,
  resetPasswordForUser,
  updateUserCommission,
}
