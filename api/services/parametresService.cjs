/**
 * @module parametresService
 * @description Service de gestion des paramètres système.
 * Responsabilité unique : lire et mettre à jour les paramètres (taux de commission, etc.).
 */
'use strict'

const { getSupabase } = require('../db.cjs')

/**
 * Récupère tous les paramètres système.
 * @returns {Promise<Object>} Objet avec les clés/valeurs des paramètres.
 */
async function getAllParametres() {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('parametres').select('cle, valeur, description')
  if (error) throw error
  const result = {}
  for (const p of data || []) {
    result[p.cle] = p.valeur
  }
  return result
}

/**
 * Met à jour la valeur d'un paramètre système.
 * @param {string} cle - La clé du paramètre.
 * @param {string} valeur - La nouvelle valeur.
 * @returns {Promise<boolean>} true si la mise à jour a réussi.
 */
async function updateParametre(cle, valeur) {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('parametres')
    .update({ valeur, updated_at: new Date().toISOString() })
    .eq('cle', cle)
  if (error) throw error
  return true
}

module.exports = {
  getAllParametres,
  updateParametre,
}
