const bcrypt = require('bcryptjs');
const { getSupabase } = require('./db.cjs');

// Fonction de seed : à exécuter une seule fois via `node api/models.cjs`
async function seedIfEmpty() {
  const supabase = getSupabase();

  // Vérifier si des utilisateurs existent déjà
  const { data: existingUsers, error: checkError } = await supabase.from('users').select('id').limit(1);

  if (checkError) {
    console.error('❌ Erreur vérification users:', checkError.message);
    console.log('⚠️  Assurez-vous d\'avoir exécuté supabase-schema.sql sur le dashboard Supabase');
    return;
  }

  if (existingUsers && existingUsers.length > 0) {
    console.log('📦 Users déjà présents, seed ignoré');
    return;
  }

  const hash = bcrypt.hashSync('password123', 10);

  const users = [
    { nom: 'Marcel', email: 'marcel@artisan.fr', password_hash: hash, role: 'permanent' },
    { nom: 'Sophie', email: 'sophie@artisan.fr', password_hash: hash, role: 'permanent' },
    { nom: 'Jean', email: 'jean@artisan.fr', password_hash: hash, role: 'permanent' },
    { nom: 'Lucas', email: 'lucas@artisan.fr', password_hash: hash, role: 'temporaire' },
    { nom: 'Emma', email: 'emma@artisan.fr', password_hash: hash, role: 'temporaire' }
  ];

  for (const user of users) {
    const { error } = await supabase.from('users').insert(user);
    if (error) {
      console.error(`❌ Erreur insertion ${user.nom}:`, error.message);
    } else {
      console.log(`✅ Utilisateur ${user.nom} créé`);
    }
  }

  console.log('✅ Seed terminé !');
}

// Exécuter le seed si lancé directement
if (require.main === module) {
  require('dotenv').config();
  seedIfEmpty()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Erreur seed:', err);
      process.exit(1);
    });
}

async function findUserByEmail(email) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('users').select('*').eq('email', email).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

async function findUserById(id) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('users')
    .select('id, nom, email, role, est_actif')
    .eq('id', id)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

async function getAllArtisans() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('users')
    .select('id, nom, email, role')
    .eq('est_actif', 1)
    .in('role', ['permanent', 'temporaire']);
  if (error) throw error;
  return data || [];
}

async function createVente(article, quantite, prix, type_paiement, artisan_id, vendeur_id, date_vente) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('ventes')
    .insert({ article, quantite, prix, type_paiement, artisan_id, vendeur_id, date_vente })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function getAllVentes() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('ventes')
    .select(`
      *,
      artisan:artisan_id (nom),
      vendeur:vendeur_id (nom)
    `)
    .order('date_vente', { ascending: false })
    .order('id', { ascending: false });
  if (error) throw error;

  return (data || []).map(v => ({
    ...v,
    artisan_nom: v.artisan?.nom || null,
    vendeur_nom: v.vendeur?.nom || null,
    artisan: undefined,
    vendeur: undefined
  }));
}

async function getVentesByArtisan(artisan_id) {
  const supabase = getSupabase();
  const { data: ventes, error: ventesError } = await supabase
    .from('ventes')
    .select(`
      *,
      artisan:artisan_id (nom),
      vendeur:vendeur_id (nom)
    `)
    .eq('artisan_id', artisan_id)
    .order('date_vente', { ascending: false })
    .order('id', { ascending: false });
  if (ventesError) throw ventesError;

  const formattedVentes = (ventes || []).map(v => ({
    ...v,
    artisan_nom: v.artisan?.nom || null,
    vendeur_nom: v.vendeur?.nom || null,
    artisan: undefined,
    vendeur: undefined
  }));

  const total_articles = formattedVentes.reduce((sum, v) => sum + (v.quantite || 0), 0);
  const total_montant = formattedVentes.reduce((sum, v) => sum + ((v.prix || 0) * (v.quantite || 0)), 0);

  return { ventes: formattedVentes, summary: { total_articles, total_montant } };
}

async function updateVente(id, fields) {
  const allowed = ['article', 'quantite', 'prix', 'type_paiement', 'artisan_id', 'date_vente'];
  const updateData = {};
  for (const key of allowed) {
    if (fields[key] !== undefined) updateData[key] = fields[key];
  }
  if (Object.keys(updateData).length === 0) return false;

  const supabase = getSupabase();
  const { error } = await supabase.from('ventes').update(updateData).eq('id', id);
  if (error) throw error;
  return true;
}

async function deleteVente(id) {
  const supabase = getSupabase();
  const { error } = await supabase.from('ventes').delete().eq('id', id);
  if (error) throw error;
  return true;
}

module.exports = {
  seedIfEmpty,
  findUserByEmail,
  findUserById,
  getAllArtisans,
  createVente,
  getAllVentes,
  getVentesByArtisan,
  updateVente,
  deleteVente
};