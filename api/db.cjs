/**
 * @file Gestion de la connexion à Supabase.
 * Implémente le pattern Singleton pour le client Supabase.
 * @module db
 */
const { createClient } = require('@supabase/supabase-js');

/** @type {import('@supabase/supabase-js').SupabaseClient|null} Instance Supabase singleton */
let supabase;

/**
 * Initialise et retourne le client Supabase (singleton).
 * Utilise la clé service_role pour contourner les RLS (Row-Level Security).
 * @returns {import('@supabase/supabase-js').SupabaseClient} L'instance du client Supabase.
 * @throws {Error} Si les variables d'environnement VITE_PUBLIC_SUPABASE_URL ou VITE_PUBLIC_SUPABASE_ANON_KEY sont manquantes.
 */
function getSupabase() {
  if (!supabase) {
    const supabaseUrl = process.env.VITE_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Variables VITE_PUBLIC_SUPABASE_URL et VITE_PUBLIC_SUPABASE_ANON_KEY requises');
    }

    // Utiliser la clé service_role pour les opérations backend (bypass RLS)
    supabase = createClient(supabaseUrl, serviceRoleKey || supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return supabase;
}

/**
 * Récupère la première ligne d'une table Supabase correspondant aux critères de recherche.
 * @param {string} table - Nom de la table Supabase.
 * @param {Object} [match={}] - Objet de critères de correspondance (clé-valeur).
 * @returns {Promise<Object|null>} La première ligne trouvée, ou null si aucun résultat.
 */
async function getFirst(table, match = {}) {
  const sb = getSupabase();
  let query = sb.from(table).select('*');
  Object.entries(match).forEach(([key, value]) => {
    query = query.eq(key, value);
  });
  const { data, error } = await query.limit(1).single();
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  return data || null;
}

/**
 * Récupère toutes les lignes d'une table Supabase.
 * @param {string} table - Nom de la table Supabase.
 * @param {string} [select='*'] - Colonnes à sélectionner.
 * @param {Object} [options={}] - Options supplémentaires.
 * @param {Object} [options.order] - Options d'ordonnancement.
 * @param {string} options.order.column - Colonne pour l'ordonnancement.
 * @param {boolean} [options.order.ascending=false] - Ordre croissant ou décroissant.
 * @returns {Promise<Array>} Tableau des résultats, ou tableau vide si aucun résultat.
 */
async function getAll(table, select = '*', options = {}) {
  const sb = getSupabase();
  let query = sb.from(table).select(select);
  if (options.order) {
    query = query.order(options.order.column, { ascending: options.order.ascending ?? false });
  }
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

module.exports = { getSupabase, getFirst, getAll };