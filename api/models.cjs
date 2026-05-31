/**
 * @file Modèles de données pour l'application SiteCaisse.
 * Contient les fonctions de CRUD pour les utilisateurs et les ventes.
 * @module models
 */
const bcrypt = require('bcryptjs');
const { getSupabase } = require('./db.cjs');

/**
 * Vérifie si des utilisateurs existent dans la table users.
 * Si la table est vide, insère 5 utilisateurs de démonstration avec le mot de passe "password123".
 * @returns {Promise<void>}
 */
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
    { nom: 'Admin', email: 'admin@sitecaisse.fr', password_hash: hash, role: 'admin' },
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

/**
 * Recherche un utilisateur par son adresse email.
 * @param {string} email - L'adresse email de l'utilisateur à rechercher.
 * @returns {Promise<Object|null>} L'objet utilisateur complet, ou null si non trouvé.
 */
async function findUserByEmail(email) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('users').select('*').eq('email', email).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

/**
 * Recherche un utilisateur par son ID.
 * @param {number} id - L'ID de l'utilisateur à rechercher.
 * @returns {Promise<Object|null>} L'objet utilisateur (id, nom, email, role, est_actif), ou null si non trouvé.
 */
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

/**
 * Récupère tous les artisans actifs ayant un rôle permanent ou temporaire.
 * @returns {Promise<Array>} Tableau des artisans (id, nom, email, role).
 */
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

/**
 * Crée une nouvelle vente dans la base de données.
 * @param {string} article - Nom de l'article vendu.
 * @param {number} quantite - Quantité vendue.
 * @param {number} prix - Prix unitaire de l'article.
 * @param {string} type_paiement - Type de paiement (CB, Espece, Cheque).
 * @param {number} artisan_id - ID de l'artisan concerné.
 * @param {number} vendeur_id - ID de l'utilisateur qui a effectué la vente.
 * @param {string} date_vente - Date de la vente au format ISO.
 * @returns {Promise<number>} L'ID de la vente créée.
 */
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

/**
 * Récupère toutes les ventes avec les noms des artisans et vendeurs associés.
 * @returns {Promise<Array>} Tableau des ventes formatées avec artisan_nom et vendeur_nom.
 */
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

/**
 * Récupère les ventes d'un artisan spécifique avec un résumé.
 * @param {number} artisan_id - ID de l'artisan.
 * @returns {Promise<{ventes: Array, summary: {total_articles: number, total_montant: number}}>}
 * Un objet contenant les ventes formatées et un résumé (nombre total d'articles et montant total).
 */
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

/**
 * Met à jour une vente existante avec les champs fournis.
 * Seuls les champs autorisés sont appliqués.
 * @param {number} id - ID de la vente à modifier.
 * @param {Object} fields - Objet contenant les champs à mettre à jour.
 * @param {string} [fields.article] - Nouveau nom de l'article.
 * @param {number} [fields.quantite] - Nouvelle quantité.
 * @param {number} [fields.prix] - Nouveau prix unitaire.
 * @param {string} [fields.type_paiement] - Nouveau type de paiement.
 * @param {number} [fields.artisan_id] - Nouvel ID de l'artisan.
 * @param {string} [fields.date_vente] - Nouvelle date de vente.
 * @returns {Promise<boolean>} true si la mise à jour a réussi, false si aucun champ valide fourni.
 */
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

/**
 * Supprime une vente par son ID.
 * @param {number} id - ID de la vente à supprimer.
 * @returns {Promise<boolean>} true si la suppression a réussi.
 */
async function deleteVente(id) {
  const supabase = getSupabase();
  const { error } = await supabase.from('ventes').delete().eq('id', id);
  if (error) throw error;
  return true;
}

/**
 * Vérifie si un compte administrateur existe, et le crée si nécessaire.
 * Cette fonction est appelée au démarrage du serveur pour garantir
 * qu'il y a toujours au moins un admin.
 * @returns {Promise<void>}
 */
async function seedAdminIfMissing() {
  const supabase = getSupabase();

  const { data: existingAdmin } = await supabase
    .from('users')
    .select('id')
    .eq('email', 'admin@sitecaisse.fr')
    .maybeSingle();

  if (existingAdmin) {
    console.log('✅ Compte admin déjà présent');
    return;
  }

  const hash = bcrypt.hashSync('password123', 10);
  const { error } = await supabase
    .from('users')
    .insert({ nom: 'Admin', email: 'admin@sitecaisse.fr', password_hash: hash, role: 'admin' });

  if (error) {
    console.error('❌ Erreur création compte admin:', error.message);
  } else {
    console.log('✅ Compte admin créé (admin@sitecaisse.fr / password123)');
  }
}

module.exports = {
  seedIfEmpty,
  seedAdminIfMissing,
  findUserByEmail,
  findUserById,
  getAllArtisans,
  createVente,
  getAllVentes,
  getVentesByArtisan,
  updateVente,
  deleteVente
};
