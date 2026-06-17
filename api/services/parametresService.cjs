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
 * Si la clé n'existe pas, elle est créée automatiquement (upsert).
 * @param {string} cle - La clé du paramètre.
 * @param {string} valeur - La nouvelle valeur.
 * @param {string} [description] - Description optionnelle pour la création.
 * @returns {Promise<boolean>} true si la mise à jour a réussi.
 */
async function updateParametre(cle, valeur, description = '') {
  const supabase = getSupabase()
  
  // Vérifier si la clé existe déjà
  const { data: existing } = await supabase
    .from('parametres')
    .select('cle')
    .eq('cle', cle)
    .maybeSingle()

  if (existing) {
    // Mise à jour
    const { error } = await supabase
      .from('parametres')
      .update({ valeur, updated_at: new Date().toISOString() })
      .eq('cle', cle)
    if (error) throw error
  } else {
    // Création
    const { error } = await supabase
      .from('parametres')
      .insert({ cle, valeur, description, updated_at: new Date().toISOString() })
    if (error) throw error
  }

  return true
}

module.exports = {
  getAllParametres,
  updateParametre,
}
