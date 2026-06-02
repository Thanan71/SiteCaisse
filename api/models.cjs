/**
 * @file Modèles de données pour l'application SiteCaisse.
 * Contient les fonctions de CRUD pour les utilisateurs et les ventes.
 * @module models
 */
const { getSupabase } = require('./db.cjs')

/**
 * Vérifie si des utilisateurs existent dans la table users.
 * Si la table est vide, insère 6 utilisateurs de démonstration
 * et les crée dans Supabase Auth.
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

  const defaultPassword = 'password123'
  const users = [
    { nom: 'Admin', email: 'admin@sitecaisse.fr', role: 'admin' },
    { nom: 'Marcel', email: 'marcel@artisan.fr', role: 'permanent' },
    { nom: 'Sophie', email: 'sophie@artisan.fr', role: 'permanent' },
    { nom: 'Jean', email: 'jean@artisan.fr', role: 'permanent' },
    { nom: 'Lucas', email: 'lucas@artisan.fr', role: 'temporaire' },
    { nom: 'Emma', email: 'emma@artisan.fr', role: 'temporaire' },
  ]

  for (const user of users) {
    try {
      // 1. Créer l'utilisateur dans Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: defaultPassword,
        email_confirm: true,
        user_metadata: {
          nom: user.nom,
          role: user.role,
          user_id: null, // sera mis à jour après insertion dans notre table
        },
      })

      let authId
      if (authError) {
        // Si l'utilisateur existe déjà dans Auth, le récupérer
        if (authError.status === 409) {
          console.log(`👤 ${user.nom} existe déjà dans Auth, récupération...`)
          const { data: existingAuth } = await supabase.auth.admin.listUsers()
          const existingUser = existingAuth?.users?.find((u) => u.email === user.email)
          if (existingUser) {
            authId = existingUser.id
            // Mettre à jour le mot de passe
            await supabase.auth.admin.updateUserById(authId, {
              password: defaultPassword,
              user_metadata: { nom: user.nom, role: user.role, user_id: null },
            })
          } else {
            console.error(`❌ Erreur création ${user.nom} dans Auth:`, authError.message)
            continue
          }
        } else {
          console.error(`❌ Erreur création ${user.nom} dans Auth:`, authError.message)
          continue
        }
      } else {
        authId = authData?.user?.id
      }

      if (!authId) {
        console.error(`❌ Aucun authId pour ${user.nom}`)
        continue
      }

      // 2. Insérer dans notre table users
      const { error: insertError } = await supabase.from('users').insert({
        nom: user.nom,
        email: user.email,
        role: user.role,
        auth_id: authId,
        password_hash: '',
      })

      if (insertError) {
        console.error(`❌ Erreur insertion ${user.nom}:`, insertError.message)
        continue
      }

      // 3. Récupérer l'ID de notre table pour mettre à jour user_metadata
      const { data: insertedUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', user.email)
        .maybeSingle()

      if (insertedUser) {
        await supabase.auth.admin.updateUserById(authId, {
          user_metadata: { nom: user.nom, role: user.role, user_id: insertedUser.id },
        })
      }

      console.log(`✅ Utilisateur ${user.nom} créé (email: ${user.email}, mdp: ${defaultPassword})`)
    } catch (err) {
      console.error(`❌ Erreur seed ${user.nom}:`, err.message)
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
 * Recherche un utilisateur par son adresse email.
 * @param {string} email - L'adresse email de l'utilisateur à rechercher.
 * @returns {Promise<Object|null>} L'objet utilisateur complet, ou null si non trouvé.
 */
async function findUserByEmail(email) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('users').select('*').eq('email', email).single()
  if (error && error.code !== 'PGRST116') throw error
  return data || null
}

/**
 * Recherche un utilisateur par son ID.
 * @param {number} id - L'ID de l'utilisateur à rechercher.
 * @returns {Promise<Object|null>} L'objet utilisateur (id, nom, email, role, est_actif), ou null si non trouvé.
 */
async function findUserById(id) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('users')
    .select('id, nom, email, role, est_actif, date_fin')
    .eq('id', id)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data || null
}

/**
 * Récupère tous les artisans actifs ayant un rôle permanent ou temporaire.
 * @returns {Promise<Array>} Tableau des artisans (id, nom, email, role).
 */
async function getAllArtisans() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('users')
    .select('id, nom, email, role')
    .eq('est_actif', 1)
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

function summarizeVentes(ventes) {
  return ventes.reduce(
    (summary, vente) => ({
      total_articles: summary.total_articles + vente.total_articles,
      total_montant: summary.total_montant + vente.total_montant,
    }),
    { total_articles: 0, total_montant: 0 },
  )
}

function formatVente(vente, articlesByVente) {
  const venteArticles = articlesByVente[vente.id] || []
  const total_articles = venteArticles.reduce((sum, article) => sum + (article.quantite || 0), 0)
  const total_montant = venteArticles.reduce(
    (sum, article) => sum + article.prix * article.quantite,
    0,
  )

  return {
    id: vente.id,
    type_paiement: vente.type_paiement,
    artisan_id: vente.artisan_id,
    vendeur_id: vente.vendeur_id,
    date_vente: vente.date_vente,
    created_at: vente.created_at,
    artisan_nom: vente.artisan?.nom || null,
    artisan_role: vente.artisan?.role || null,
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
 * @param {number} artisan_id - ID de l'artisan concerné.
 * @param {number} vendeur_id - ID de l'utilisateur qui a effectué la vente.
 * @param {string} date_vente - Date de la vente au format ISO.
 * @returns {Promise<number>} L'ID de la vente créée.
 */
async function createVente(articles, type_paiement, artisan_id, vendeur_id, date_vente) {
  const supabase = getSupabase()

  // 1. Créer l'en-tête de la vente
  const { data: venteData, error: venteError } = await supabase
    .from('ventes')
    .insert({ type_paiement, artisan_id, vendeur_id, date_vente })
    .select('id')
    .single()

  if (venteError) throw venteError
  const venteId = venteData.id

  // 2. Insérer les lignes d'articles
  const articlesData = articles.map((a) => ({
    vente_id: venteId,
    article: a.article,
    quantite: a.quantite || 1,
    prix: a.prix,
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
        artisan:artisan_id (nom, role),
        vendeur:vendeur_id (nom)
      `)
      .order('date_vente', { ascending: false })
      .order('id', { ascending: false })
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
  const supabase = getSupabase()
  const { data: ventes, error: ventesError } = await supabase
    .from('ventes')
    .select(`
      *,
      artisan:artisan_id (nom, role),
      vendeur:vendeur_id (nom)
    `)
    .eq('artisan_id', artisan_id)
    .order('date_vente', { ascending: false })
    .order('id', { ascending: false })

  if (ventesError) throw ventesError

  if (!ventes || ventes.length === 0)
    return { ventes: [], summary: { total_articles: 0, total_montant: 0 } }

  const formattedVentes = await formatVentesWithArticles(supabase, ventes)
  return { ventes: formattedVentes, summary: summarizeVentes(formattedVentes) }
}

/**
 * Récupère les ventes de tous les artisans groupées par artisan, avec un résumé global.
 * @returns {Promise<{groupes: Array, total: {total_articles: number, total_montant: number}}>}
 */
async function getAllVentesGroupedByArtisan(options = {}) {
  const result = await getAllVentes(options)
  const allVentes = result.ventes

  // Grouper par artisan_id
  const grouped = {}
  for (const vente of allVentes) {
    const key = vente.artisan_id
    if (!grouped[key]) {
      grouped[key] = {
        artisan_id: vente.artisan_id,
        artisan_nom: vente.artisan_nom,
        ventes: [],
      }
    }
    grouped[key].ventes.push(vente)
  }

  // Construire le tableau de groupes avec le résumé par artisan
  const groupes = Object.values(grouped).map((g) => {
    return {
      artisan_id: g.artisan_id,
      artisan_nom: g.artisan_nom,
      ventes: g.ventes,
      summary: summarizeVentes(g.ventes),
    }
  })

  // Trier les groupes par nom d'artisan
  groupes.sort((a, b) => (a.artisan_nom || '').localeCompare(b.artisan_nom || ''))

  // Résumé global
  const total = groupes.reduce(
    (summary, groupe) => ({
      total_articles: summary.total_articles + groupe.summary.total_articles,
      total_montant: summary.total_montant + groupe.summary.total_montant,
    }),
    { total_articles: 0, total_montant: 0 },
  )

  return {
    groupes,
    total,
    pagination: result.pagination,
  }
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
  const supabase = getSupabase()

  // Mettre à jour l'en-tête de la vente
  const allowed = ['type_paiement', 'artisan_id', 'date_vente']
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
 * Vérifie si un compte administrateur existe, le crée si nécessaire,
 * ou met à jour le mot de passe si besoin.
 * @returns {Promise<void>}
 */
async function seedAdminIfMissing() {
  const supabase = getSupabase()

  const defaultPassword = 'password123'

  const { data: existingAdmin } = await supabase
    .from('users')
    .select('id, email, auth_id')
    .eq('email', 'admin@sitecaisse.fr')
    .maybeSingle()

  if (existingAdmin) {
    // Mettre à jour le mot de passe dans Supabase Auth si l'auth_id existe
    if (existingAdmin.auth_id) {
      await supabase.auth.admin.updateUserById(existingAdmin.auth_id, {
        password: defaultPassword,
        user_metadata: {
          nom: 'Admin',
          role: 'admin',
          user_id: existingAdmin.id,
        },
      })
      console.log('✅ Mot de passe admin vérifié et mis à jour')
    } else {
      // Créer un compte Auth pour cet admin existant
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: 'admin@sitecaisse.fr',
        password: defaultPassword,
        email_confirm: true,
        user_metadata: {
          nom: 'Admin',
          role: 'admin',
          user_id: existingAdmin.id,
        },
      })

      if (authError && authError.status !== 409) {
        console.error('❌ Erreur création compte Auth admin:', authError.message)
      } else if (authData?.user?.id) {
        // Lier le compte Auth à notre utilisateur
        await supabase
          .from('users')
          .update({ auth_id: authData.user.id })
          .eq('id', existingAdmin.id)
        console.log('✅ Compte Auth lié à admin existant')
      }
    }
    return
  }

  // Créer l'admin complet (Auth + table)
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: 'admin@sitecaisse.fr',
    password: defaultPassword,
    email_confirm: true,
    user_metadata: {
      nom: 'Admin',
      role: 'admin',
      user_id: null,
    },
  })

  if (authError) {
    console.error('❌ Erreur création admin dans Auth:', authError.message)
    return
  }

  const authId = authData?.user?.id
  if (!authId) return

  const { error } = await supabase.from('users').insert({
    nom: 'Admin',
    email: 'admin@sitecaisse.fr',
    password_hash: '',
    role: 'admin',
    auth_id: authId,
  })

  if (error) {
    console.error('❌ Erreur création compte admin en base:', error.message)
    return
  }

  // Mettre à jour user_metadata
  const { data: inserted } = await supabase
    .from('users')
    .select('id')
    .eq('email', 'admin@sitecaisse.fr')
    .maybeSingle()

  if (inserted) {
    await supabase.auth.admin.updateUserById(authId, {
      user_metadata: { nom: 'Admin', role: 'admin', user_id: inserted.id },
    })
  }

  console.log('✅ Compte admin créé (admin@sitecaisse.fr / password123)')
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
  deleteVente,
}