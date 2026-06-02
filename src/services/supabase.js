/**
 * @module services/supabase
 * @description Client Supabase pour le frontend.
 * Utilise la clé anon (publique) et l'URL du projet depuis les variables d'environnement.
 * Gère l'authentification via Supabase Auth (email/password).
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '⚠️ Variables d\'environnement VITE_PUBLIC_SUPABASE_URL et VITE_PUBLIC_SUPABASE_ANON_KEY requises',
  )
}

/**
 * Instance Supabase côté frontend.
 * @type {import('@supabase/supabase-js').SupabaseClient}
 */
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    storageKey: 'sitecaisse-auth',
  },
})

/**
 * Connecte un utilisateur avec email et mot de passe via Supabase Auth.
 * @param {string} email - Adresse email de l'utilisateur.
 * @param {string} password - Mot de passe de l'utilisateur.
 * @returns {Promise<{data: {session: import('@supabase/supabase-js').Session|null, user: import('@supabase/supabase-js').User|null}, error: Error|null}>}
 */
export async function signInWithPassword(email, password) {
  return supabase.auth.signInWithPassword({ email, password })
}

/**
 * Déconnecte l'utilisateur courant via Supabase Auth.
 * @returns {Promise<{error: Error|null}>}
 */
export async function signOut() {
  return supabase.auth.signOut()
}

/**
 * Récupère la session Supabase actuelle.
 * @returns {Promise<{data: {session: import('@supabase/supabase-js').Session|null}, error: Error|null}>}
 */
export async function getSession() {
  return supabase.auth.getSession()
}

/**
 * Récupère l'utilisateur actuellement connecté.
 * @returns {Promise<{data: {user: import('@supabase/supabase-js').User|null}, error: Error|null}>}
 */
export async function getUser() {
  return supabase.auth.getUser()
}

/**
 * Écoute les changements d'état d'authentification.
 * @param {function} callback - Fonction appelée lors d'un changement d'état.
 * @returns {import('@supabase/supabase-js').Subscription} Subscription à annuler avec .unsubscribe()
 */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback)
}

export default supabase