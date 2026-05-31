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
    .select('id, nom, email, role, est_actif, date_fin')
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
 * Crée une nouvelle vente avec ses lignes d'articles.
 * @param {Array<{article: string, quantite: number, prix: number}>} articles - Liste des articles vendus.
 * @param {string} type_paiement - Type de paiement (CB, Espece, Cheque).
 * @param {number} artisan_id - ID de l'artisan concerné.
 * @param {number} vendeur_id - ID de l'utilisateur qui a effectué la vente.
 * @param {string} date_vente - Date de la vente au format ISO.
 * @returns {Promise<number>} L'ID de la vente créée.
 */
async function createVente(articles, type_paiement, artisan_id, vendeur_id, date_vente) {
  const supabase = getSupabase();

  // 1. Créer l'en-tête de la vente
  const { data: venteData, error: venteError } = await supabase
    .from('ventes')
    .insert({ type_paiement, artisan_id, vendeur_id, date_vente })
    .select('id')
    .single();

  if (venteError) throw venteError;
  const venteId = venteData.id;

  // 2. Insérer les lignes d'articles
  const articlesData = articles.map(a => ({
    vente_id: venteId,
    article: a.article,
    quantite: a.quantite || 1,
    prix: a.prix
  }));

  const { error: articlesError } = await supabase
    .from('vente_articles')
    .insert(articlesData);

  if (articlesError) throw articlesError;

  return venteId;
}

/**
 * Récupère toutes les ventes avec leurs lignes d'articles et les noms des artisans/vendeurs.
 * @returns {Promise<Array>} Tableau des ventes formatées avec articles, artisan_nom et vendeur_nom.
 */
async function getAllVentes() {
  const supabase = getSupabase();

  // Récupérer les en-têtes de vente
  const { data: ventes, error: ventesError } = await supabase
    .from('ventes')
    .select(`
      *,
      artisan:artisan_id (nom, role),
      vendeur:vendeur_id (nom)
    `)
    .order('date_vente', { ascending: false })
    .order('id', { ascending: false });

  if (ventesError) throw ventesError;

  if (!ventes || ventes.length === 0) return [];

  // Récupérer les articles pour toutes ces ventes
  const venteIds = ventes.map(v => v.id);
  const { data: articles, error: articlesError } = await supabase
    .from('vente_articles')
    .select('*')
    .in('vente_id', venteIds)
    .order('id', { ascending: true });

  if (articlesError) throw articlesError;

  // Grouper les articles par vente_id
  const articlesByVente = {};
  for (const art of articles || []) {
    if (!articlesByVente[art.vente_id]) {
      articlesByVente[art.vente_id] = [];
    }
    articlesByVente[art.vente_id].push(art);
  }

  return ventes.map(v => {
    const venteArticles = articlesByVente[v.id] || [];
    const total_articles = venteArticles.reduce((sum, a) => sum + (a.quantite || 0), 0);
    const total_montant = venteArticles.reduce((sum, a) => sum + (a.prix * a.quantite), 0);

    return {
      id: v.id,
      type_paiement: v.type_paiement,
      artisan_id: v.artisan_id,
      vendeur_id: v.vendeur_id,
      date_vente: v.date_vente,
      created_at: v.created_at,
      artisan_nom: v.artisan?.nom || null,
      artisan_role: v.artisan?.role || null,
      vendeur_nom: v.vendeur?.nom || null,
      articles: venteArticles,
      total_articles,
      total_montant
    };
  });
}

/**
 * Récupère les ventes d'un artisan spécifique avec un résumé.
 * @param {number} artisan_id - ID de l'artisan.
 * @returns {Promise<{ventes: Array, summary: {total_articles: number, total_montant: number}}>}
 */
async function getVentesByArtisan(artisan_id) {
  const supabase = getSupabase();
  const { data: ventes, error: ventesError } = await supabase
    .from('ventes')
    .select(`
      *,
      artisan:artisan_id (nom, role),
      vendeur:vendeur_id (nom)
    `)
    .eq('artisan_id', artisan_id)
    .order('date_vente', { ascending: false })
    .order('id', { ascending: false });

  if (ventesError) throw ventesError;

  if (!ventes || ventes.length === 0) return { ventes: [], summary: { total_articles: 0, total_montant: 0 } };

  const venteIds = ventes.map(v => v.id);
  const { data: articles, error: articlesError } = await supabase
    .from('vente_articles')
    .select('*')
    .in('vente_id', venteIds)
    .order('id', { ascending: true });

  if (articlesError) throw articlesError;

  const articlesByVente = {};
  for (const art of articles || []) {
    if (!articlesByVente[art.vente_id]) {
      articlesByVente[art.vente_id] = [];
    }
    articlesByVente[art.vente_id].push(art);
  }

  const formattedVentes = ventes.map(v => {
    const venteArticles = articlesByVente[v.id] || [];
    return {
      id: v.id,
      type_paiement: v.type_paiement,
      artisan_id: v.artisan_id,
      vendeur_id: v.vendeur_id,
      date_vente: v.date_vente,
      created_at: v.created_at,
      artisan_nom: v.artisan?.nom || null,
      artisan_role: v.artisan?.role || null,
      vendeur_nom: v.vendeur?.nom || null,
      articles: venteArticles,
      total_articles: venteArticles.reduce((sum, a) => sum + (a.quantite || 0), 0),
      total_montant: venteArticles.reduce((sum, a) => sum + (a.prix * a.quantite), 0)
    };
  });

  const total_articles = formattedVentes.reduce((sum, v) => sum + v.total_articles, 0);
  const total_montant = formattedVentes.reduce((sum, v) => sum + v.total_montant, 0);

  return { ventes: formattedVentes, summary: { total_articles, total_montant } };
}

/**
 * Récupère les ventes de tous les artisans groupées par artisan, avec un résumé global.
 * @returns {Promise<{groupes: Array, total: {total_articles: number, total_montant: number}}>}
 */
async function getAllVentesGroupedByArtisan() {
  const allVentes = await getAllVentes();

  // Grouper par artisan_id
  const grouped = {};
  for (const vente of allVentes) {
    const key = vente.artisan_id;
    if (!grouped[key]) {
      grouped[key] = {
        artisan_id: vente.artisan_id,
        artisan_nom: vente.artisan_nom,
        ventes: []
      };
    }
    grouped[key].ventes.push(vente);
  }

  // Construire le tableau de groupes avec le résumé par artisan
  const groupes = Object.values(grouped).map(g => {
    const total_articles = g.ventes.reduce((sum, v) => sum + v.total_articles, 0);
    const total_montant = g.ventes.reduce((sum, v) => sum + v.total_montant, 0);
    return {
      artisan_id: g.artisan_id,
      artisan_nom: g.artisan_nom,
      ventes: g.ventes,
      summary: { total_articles, total_montant }
    };
  });

  // Trier les groupes par nom d'artisan
  groupes.sort((a, b) => (a.artisan_nom || '').localeCompare(b.artisan_nom || ''));

  // Résumé global
  const total_articles = groupes.reduce((sum, g) => sum + g.summary.total_articles, 0);
  const total_montant = groupes.reduce((sum, g) => sum + g.summary.total_montant, 0);

  return { groupes, total: { total_articles, total_montant } };
}

/**
 * Met à jour une vente existante (en-tête et articles).
 * @param {number} id - ID de la vente à modifier.
 * @param {Object} fields - Objet contenant les champs à mettre à jour.
 * @param {string} [fields.type_paiement] - Nouveau type de paiement.
 * @param {number} [fields.artisan_id] - Nouvel ID de l'artisan.
 * @param {string} [fields.date_vente] - Nouvelle date de vente.
 * @param {Array<{id?: number, article: string, quantite: number, prix: number}>} [fields.articles] - Nouvelle liste d'articles.
 * @returns {Promise<boolean>} true si la mise à jour a réussi.
 */
async function updateVente(id, fields) {
  const supabase = getSupabase();

  // Mettre à jour l'en-tête de la vente
  const allowed = ['type_paiement', 'artisan_id', 'date_vente'];
  const updateData = {};
  for (const key of allowed) {
    if (fields[key] !== undefined) updateData[key] = fields[key];
  }

  if (Object.keys(updateData).length > 0) {
    const { error } = await supabase.from('ventes').update(updateData).eq('id', id);
    if (error) throw error;
  }

  // Mettre à jour les articles si fournis
  if (fields.articles && Array.isArray(fields.articles)) {
    // Supprimer tous les anciens articles
    const { error: deleteError } = await supabase
      .from('vente_articles')
      .delete()
      .eq('vente_id', id);

    if (deleteError) throw deleteError;

    // Insérer les nouveaux articles
    const articlesData = fields.articles.map(a => ({
      vente_id: id,
      article: a.article,
      quantite: a.quantite || 1,
      prix: a.prix
    }));

    const { error: insertError } = await supabase
      .from('vente_articles')
      .insert(articlesData);

    if (insertError) throw insertError;
  }

  return true;
}

/**
 * Supprime une vente et ses articles associés par son ID.
 * @param {number} id - ID de la vente à supprimer.
 * @returns {Promise<boolean>} true si la suppression a réussi.
 */
async function deleteVente(id) {
  const supabase = getSupabase();
  // La suppression en cascade via la clé étrangère sur vente_articles s'occupe des articles
  const { error } = await supabase.from('ventes').delete().eq('id', id);
  if (error) throw error;
  return true;
}

/**
 * Vérifie si un compte administrateur existe, le crée si nécessaire,
 * ou met à jour le mot de passe si le hash actuel est invalide.
 * @returns {Promise<void>}
 */
async function seedAdminIfMissing() {
  const supabase = getSupabase();

  const hash = bcrypt.hashSync('password123', 10);

  const { data: existingAdmin } = await supabase
    .from('users')
    .select('id')
    .eq('email', 'admin@sitecaisse.fr')
    .maybeSingle();

  if (existingAdmin) {
    // Mettre à jour le mot de passe pour garantir qu'il soit valide
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: hash })
      .eq('id', existingAdmin.id);

    if (updateError) {
      console.error('❌ Erreur mise à jour mot de passe admin:', updateError.message);
    } else {
      console.log('✅ Mot de passe admin vérifié et mis à jour');
    }
    return;
  }

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
  getAllVentesGroupedByArtisan,
  updateVente,
  deleteVente
};