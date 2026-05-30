const { createClient } = require('@supabase/supabase-js');

let supabase;

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

// Helper: retourne la première ligne
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

// Helper: retourne toutes les lignes
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