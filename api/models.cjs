/**
 * @file Modèles de données pour l'application SiteCaisse.
 * Contient les fonctions de CRUD pour les utilisateurs et les ventes.
 * @module models
 */
const bcrypt = require('bcryptjs')
const { getSupabase } = require('./db.cjs')
const {
  filterVentesByArtisan,
  groupVentesByArtisan,
  groupVentesByMonth,
  groupVentesForMonth,
} = require('./services/venteAggregationService.cjs')

/**
 * Vérifie si des utilisateurs existent dans la table users.
 * Si la table est vide, insère 5 utilisateurs de démonstration avec le mot de passe "password123".
 * @returns {Promise<void>}
 */
async function seedIfEmpty() {
  const supabase = getSupabase()

  // Vérifier si des utilisateurs existent déjà
  const { data: existingUsers, error: checkError } = await supabase
    .from('users')
    .select('id')
    .limit(1)

  if (checkError) {
    console.error('❌ Erreur vérification users:', checkError.message)
    console.log("⚠️  Assurez-vous d'avoir exécuté supabase-schema.sql sur le dashboard Supabase")
    return
  }

  if (existingUsers && existingUsers.length > 0) {
    console.log('📦 Users déjà présents, seed ignoré')
    return
  }

  const hash = bcrypt.hashSync('password123', 10)

  const users = [
    {
      nom: 'Admin',
      nom_boutique: 'Administration',
      password_hash: hash,
      generated_password: 'password123',
      role: 'admin',
    },
    {
      nom: 'Marcel',
      nom_boutique: 'Atelier Marcel',
      password_hash: hash,
      generated_password: 'password123',
      role: 'permanent',
    },
    {
      nom: 'Sophie',
      nom_boutique: 'Boutique Sophie',
      password_hash: hash,
      generated_password: 'password123',
      role: 'permanent',
    },
    {
      nom: 'Jean',
      nom_boutique: 'Creation Jean',
      password_hash: hash,
      generated_password: 'password123',
      role: 'permanent',
    },
    {
      nom: 'Lucas',
      nom_boutique: 'Echoppe Lucas',
      password_hash: hash,
      generated_password: 'password123',
      role: 'temporaire',
    },
    {
      nom: 'Emma',
      nom_boutique: 'Atelier Emma',
      password_hash: hash,
      generated_password: 'password123',
      role: 'temporaire',
    },
  ]

  for (const user of users) {
    const { error } = await supabase.from('users').insert(user)
    if (error) {
      console.error(`❌ Erreur insertion ${user.nom}:`, error.message)
    } else {
      console.log(`✅ Utilisateur ${user.nom} créé`)
    }
  }

  console.log('✅ Seed terminé !')
}

// Exécuter le seed si lancé directement
if (require.main === module) {
  require('dotenv').config()
  seedIfEmpty()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Erreur seed:', err)
      process.exit(1)
    })
}

/**
 * Recherche un utilisateur par son nom de boutique.
 * @param {string} nomBoutique - Le nom de boutique de l'utilisateur à rechercher.
 * @returns {Promise<Object|null>} L'objet utilisateur complet, ou null si non trouvé.
 */
async function findUserByNomBoutique(nomBoutique) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('nom_boutique', nomBoutique)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data || null
}

/**
 * Recherche un utilisateur par son ID.
 * @param {number} id - L'ID de l'utilisateur à rechercher.
 * @returns {Promise<Object|null>} L'objet utilisateur (id, nom, nom_boutique, role, est_actif), ou null si non trouvé.
 */
async function findUserById(id) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('users')
    .select(
      'id, nom, nom_boutique, role, est_actif, date_fin, password_hash, password_change_required',
    )
    .eq('id', id)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data || null
}

/**
 * Met à jour le mot de passe d'un utilisateur.
 * @param {number} id - ID de l'utilisateur.
 * @param {string} newPassword - Nouveau mot de passe en clair.
 * @returns {Promise<boolean>} true si la mise à jour a réussi.
 */
async function updatePassword(id, newPassword) {
  const supabase = getSupabase()
  const password_hash = bcrypt.hashSync(newPassword, 10)
  const { error } = await supabase
    .from('users')
    .update({ password_hash, generated_password: newPassword, password_change_required: false })
    .eq('id', id)
  if (error) throw error
  return true
}

/**
 * Récupère tous les artisans actifs ayant un rôle permanent ou temporaire.
 * @returns {Promise<Array>} Tableau des artisans (id, nom, nom_boutique, role, commission personnalisée).
 */
async function getAllArtisans() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('users')
    .select('id, nom, nom_boutique, role, commission_cb_personnalisee')
    .eq('est_actif', true)
    .in('role', ['permanent', 'temporaire'])
  if (error) throw error
  return data || []
}

function parsePositiveInt(value, fallback) {
  const parsed = parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function buildPagination(page, limit, total = 0) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  }
}

function applyVenteFilters(query, { date_debut, date_fin, type_paiement } = {}) {
  let filteredQuery = query
  if (date_debut) {
    filteredQuery = filteredQuery.gte('date_vente', date_debut)
  }
  if (date_fin) {
    filteredQuery = filteredQuery.lte('date_vente', date_fin)
  }
  if (type_paiement) {
    filteredQuery = filteredQuery.eq('type_paiement', type_paiement)
  }
  return filteredQuery
}

async function fetchArticlesByVenteIds(supabase, venteIds) {
  if (!venteIds.length) return []

  const { data, error } = await supabase
    .from('vente_articles')
    .select('*')
    .in('vente_id', venteIds)
    .order('id', { ascending: true })

  if (error) throw error
  return data || []
}

function groupArticlesByVenteId(articles) {
  return articles.reduce((groups, article) => {
    if (!groups[article.vente_id]) {
      groups[article.vente_id] = []
    }
    groups[article.vente_id].push(article)
    return groups
  }, {})
}

function formatVente(vente, articlesByVente) {
  const venteArticles = articlesByVente[vente.id] || []
  const total_articles = venteArticles.reduce((sum, article) => sum + (article.quantite || 0), 0)
  const total_montant = venteArticles.reduce(
    (sum, article) => sum + article.prix * article.quantite,
    0,
  )
  const articleArtisanIds = [
    ...new Set(
      venteArticles
        .map((article) => article.artisan_id)
        .filter((artisanId) => artisanId !== null && artisanId !== undefined),
    ),
  ]

  return {
    id: vente.id,
    type_paiement: vente.type_paiement,
    artisan_id: articleArtisanIds.length === 1 ? articleArtisanIds[0] : null,
    vendeur_id: vente.vendeur_id,
    date_vente: vente.date_vente,
    created_at: vente.created_at,
    vendeur_nom: vente.vendeur?.nom || null,
    articles: venteArticles,
    total_articles,
    total_montant,
  }
}

async function formatVentesWithArticles(supabase, ventes) {
  const venteIds = ventes.map((vente) => vente.id)
  const articles = await fetchArticlesByVenteIds(supabase, venteIds)
  const articlesByVente = groupArticlesByVenteId(articles)
  return ventes.map((vente) => formatVente(vente, articlesByVente))
}

/**
 * Crée une nouvelle vente avec ses lignes d'articles.
 * @param {Array<{article: string, quantite: number, prix: number}>} articles - Liste des articles vendus.
 * @param {string} type_paiement - Type de paiement (CB, Espece, Cheque).
 * @param {number} vendeur_id - ID de l'utilisateur qui a effectué la vente.
 * @param {string} date_vente - Date de la vente au format ISO.
 * @returns {Promise<number>} L'ID de la vente créée.
 */
async function createVente(articles, type_paiement, vendeur_id, date_vente) {
  const supabase = getSupabase()

  // 1. Créer l'en-tête de la vente
  const { data: venteData, error: venteError } = await supabase
    .from('ventes')
    .insert({ type_paiement, vendeur_id, date_vente })
    .select('id')
    .single()

  if (venteError) throw venteError
  const venteId = venteData.id

  // 2. Insérer les lignes d'articles (avec artisan_id par ligne)
  const articlesData = articles.map((a) => ({
    vente_id: venteId,
    article: a.article,
    quantite: a.quantite || 1,
    prix: a.prix,
    artisan_id: a.artisan_id || null,
  }))

  const { error: articlesError } = await supabase.from('vente_articles').insert(articlesData)

  if (articlesError) throw articlesError

  return venteId
}

/**
 * Récupère toutes les ventes avec leurs lignes d'articles et les noms des artisans/vendeurs.
 * Supporte la pagination via les paramètres page et limit.
 * @param {Object} [options] - Options de pagination et filtres.
 * @param {number} [options.page=1] - Numéro de la page (commence à 1).
 * @param {number} [options.limit=10] - Nombre de ventes par page.
 * @param {string} [options.date_debut] - Date de début pour le filtre (format ISO).
 * @param {string} [options.date_fin] - Date de fin pour le filtre (format ISO).
 * @param {string} [options.type_paiement] - Filtre par type de paiement (CB, Espece, Cheque).
 * @returns {Promise<{ventes: Array, pagination: {page: number, limit: number, total: number, totalPages: number}}>}
 */
async function getAllVentes(options = {}) {
  const supabase = getSupabase()
  const page = parsePositiveInt(options.page, 1)
  const limit = parsePositiveInt(options.limit, 10)
  const { date_debut, date_fin, type_paiement } = options
  const offset = (page - 1) * limit

  const filters = { date_debut, date_fin, type_paiement }
  const countQuery = applyVenteFilters(
    supabase.from('ventes').select('*', { count: 'exact', head: true }),
    filters,
  )
  const { count: total, error: countError } = await countQuery
  if (countError) throw countError

  const query = applyVenteFilters(
    supabase
      .from('ventes')
      .select(`
        *,
        vendeur:vendeur_id (nom)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1),
    filters,
  )
  const { data: ventes, error: ventesError } = await query
  if (ventesError) throw ventesError

  if (!ventes || ventes.length === 0) {
    return {
      ventes: [],
      pagination: buildPagination(page, limit, total || 0),
    }
  }

  const formattedVentes = await formatVentesWithArticles(supabase, ventes)

  return {
    ventes: formattedVentes,
    pagination: buildPagination(page, limit, total || 0),
  }
}

/**
 * Récupère les ventes d'un artisan spécifique avec un résumé.
 * @param {number} artisan_id - ID de l'artisan.
 * @returns {Promise<{ventes: Array, summary: {total_articles: number, total_montant: number}}>}
 */
async function getVentesByArtisan(artisan_id) {
  const allVentes = await getAllVentesUnpaginated()
  return filterVentesByArtisan(allVentes, artisan_id)
}

/**
 * Récupère toutes les ventes sans pagination (pour les rapports).
 * @returns {Promise<Array>} Liste complète des ventes formatées.
 */
async function getAllVentesUnpaginated() {
  const supabase = getSupabase()

  const { data: ventes, error: ventesError } = await supabase
    .from('ventes')
    .select(`
      *,
        vendeur:vendeur_id (nom)
    `)
    .order('created_at', { ascending: false })

  if (ventesError) throw ventesError

  if (!ventes || ventes.length === 0) return []

  return await formatVentesWithArticles(supabase, ventes)
}

/**
 * Récupère les ventes de tous les artisans groupées par artisan, avec un résumé global.
 * @param {Object} [options] - Options de pagination.
 * @returns {Promise<{groupes: Array, total: {total_articles: number, total_montant: number}}>}
 */
async function getAllVentesGroupedByArtisan(options = {}) {
  const result = options.page
    ? await getAllVentes(options)
    : { ventes: await getAllVentesUnpaginated(), pagination: null }
  const allVentes = result.ventes
  const artisansList = await getAllArtisans()
  const { groupes, total } = groupVentesByArtisan(allVentes, artisansList)

  return {
    groupes,
    total,
    pagination: result.pagination,
  }
}

/**
 * Récupère les ventes groupées par mois puis par artisan.
 * @returns {Promise<{mois: Array, total: {total_articles: number, total_montant: number}}>}
 */
async function getAllVentesGroupedByMonth() {
  const allVentes = await getAllVentesUnpaginated()

  if (!allVentes.length) {
    return { mois: [], total: { total_articles: 0, total_montant: 0 } }
  }

  const artisansList = await getAllArtisans()
  return groupVentesByMonth(allVentes, artisansList)
}

/**
 * Récupère les ventes pour un mois spécifique (format YYYY-MM), groupées par artisan.
 * @param {string} mois - Le mois au format "YYYY-MM".
 * @returns {Promise<{groupes: Array, total: {total_articles: number, total_montant: number}}>}
 */
async function getVentesByMonth(mois) {
  const allVentes = await getAllVentesUnpaginated()
  const artisansList = await getAllArtisans()
  return groupVentesForMonth(allVentes, artisansList, mois)
}

/**
 * Met à jour une vente existante (en-tête et articles).
 * @param {number} id - ID de la vente à modifier.
 * @param {Object} fields - Objet contenant les champs à mettre à jour.
 * @param {string} [fields.type_paiement] - Nouveau type de paiement.
 * @param {string} [fields.date_vente] - Nouvelle date de vente.
 * @param {Array<{id?: number, article: string, quantite: number, prix: number}>} [fields.articles] - Nouvelle liste d'articles.
 * @returns {Promise<boolean>} true si la mise à jour a réussi.
 */
async function updateVente(id, fields) {
  const supabase = getSupabase()

  // Mettre à jour l'en-tête de la vente
  const allowed = ['type_paiement', 'date_vente']
  const updateData = {}
  for (const key of allowed) {
    if (fields[key] !== undefined) updateData[key] = fields[key]
  }

  if (Object.keys(updateData).length > 0) {
    const { error } = await supabase.from('ventes').update(updateData).eq('id', id)
    if (error) throw error
  }

  // Mettre à jour les articles si fournis
  if (fields.articles && Array.isArray(fields.articles)) {
    // Supprimer tous les anciens articles
    const { error: deleteError } = await supabase.from('vente_articles').delete().eq('vente_id', id)

    if (deleteError) throw deleteError

    // Insérer les nouveaux articles
    const articlesData = fields.articles.map((a) => ({
      vente_id: id,
      article: a.article,
      quantite: a.quantite || 1,
      prix: a.prix,
      artisan_id: a.artisan_id || null,
    }))

    const { error: insertError } = await supabase.from('vente_articles').insert(articlesData)

    if (insertError) throw insertError
  }

  return true
}

/**
 * Supprime une vente et ses articles associés par son ID.
 * @param {number} id - ID de la vente à supprimer.
 * @returns {Promise<boolean>} true si la suppression a réussi.
 */
async function deleteVente(id) {
  const supabase = getSupabase()
  // La suppression en cascade via la clé étrangère sur vente_articles s'occupe des articles
  const { error } = await supabase.from('ventes').delete().eq('id', id)
  if (error) throw error
  return true
}

/**
 * Réinitialise le mot de passe d'un utilisateur avec une valeur donnée,
 * le hache et le stocke en base.
 * @param {number} id - ID de l'utilisateur.
 * @param {string} newPassword - Nouveau mot de passe en clair.
 * @returns {Promise<string>} Le nouveau mot de passe en clair.
 */
async function extendUserDateFin(id, newDateFin) {
  const supabase = getSupabase()
  const { error } = await supabase.from('users').update({ date_fin: newDateFin }).eq('id', id)

  if (error) throw error
  return true
}

async function resetUserPassword(id, newPassword) {
  const supabase = getSupabase()

  if (!newPassword) {
    throw new Error('Nouveau mot de passe requis')
  }

  const password_hash = bcrypt.hashSync(newPassword, 10)
  const { error } = await supabase
    .from('users')
    .update({ password_hash, generated_password: newPassword, password_change_required: false })
    .eq('id', id)

  if (error) throw error
  return newPassword
}

/**
 * Vérifie si un compte administrateur existe, le crée si nécessaire,
 * ou met à jour le mot de passe si le hash actuel est invalide.
 * @returns {Promise<void>}
 */
async function seedAdminIfMissing() {
  const supabase = getSupabase()

  const hash = bcrypt.hashSync('password123', 10)
  const adminBoutique = 'Administration'
  const legacyAdminBoutique = 'Admin'

  const { data: existingAdmins } = await supabase
    .from('users')
    .select('id, nom_boutique')
    .in('nom_boutique', [adminBoutique, legacyAdminBoutique])

  const existingAdmin =
    existingAdmins?.find((user) => user.nom_boutique === adminBoutique) || existingAdmins?.[0]
  if (existingAdmin) {
    // Mettre à jour le mot de passe pour garantir qu'il soit valide
    const { error: updateError } = await supabase
      .from('users')
      .update({
        nom: 'Admin',
        nom_boutique: adminBoutique,
        password_hash: hash,
        generated_password: 'password123',
        role: 'admin',
        est_actif: true,
        password_change_required: false,
        date_fin: null,
      })
      .eq('id', existingAdmin.id)

    if (updateError) {
      console.error('❌ Erreur mise à jour mot de passe admin:', updateError.message)
    } else {
      console.log('✅ Mot de passe admin vérifié et mis à jour')
    }
    return
  }

  const { error } = await supabase.from('users').insert({
    nom: 'Admin',
    nom_boutique: adminBoutique,
    password_hash: hash,
    generated_password: 'password123',
    role: 'admin',
    est_actif: true,
    password_change_required: false,
    date_fin: null,
  })

  if (error) {
    console.error('❌ Erreur création compte admin:', error.message)
  } else {
    console.log('✅ Compte admin créé (Administration / password123)')
  }
}

module.exports = {
  seedIfEmpty,
  seedAdminIfMissing,
  findUserByNomBoutique,
  findUserById,
  updatePassword,
  extendUserDateFin,
  resetUserPassword,
  getAllArtisans,
  createVente,
  getAllVentes,
  getAllVentesUnpaginated,
  getVentesByArtisan,
  getAllVentesGroupedByArtisan,
  getAllVentesGroupedByMonth,
  getVentesByMonth,
  updateVente,
  deleteVente,
}
