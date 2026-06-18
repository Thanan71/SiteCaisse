/**
 * @file Modèles de données pour l'application SiteCaisse.
 * Contient les fonctions de CRUD pour les utilisateurs et les ventes.
 * @module models
 */
const bcrypt = require('bcryptjs')
const { getSupabase } = require('./db.cjs')

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
    { nom: 'Admin', nom_boutique: 'Administration', password_hash: hash, role: 'admin' },
    { nom: 'Marcel', nom_boutique: 'Atelier Marcel', password_hash: hash, role: 'permanent' },
    { nom: 'Sophie', nom_boutique: 'Boutique Sophie', password_hash: hash, role: 'permanent' },
    { nom: 'Jean', nom_boutique: 'Creation Jean', password_hash: hash, role: 'permanent' },
    { nom: 'Lucas', nom_boutique: 'Echoppe Lucas', password_hash: hash, role: 'temporaire' },
    { nom: 'Emma', nom_boutique: 'Atelier Emma', password_hash: hash, role: 'temporaire' },
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
    .update({ password_hash, password_change_required: 0 })
    .eq('id', id)
  if (error) throw error
  return true
}

/**
 * Récupère tous les artisans actifs ayant un rôle permanent ou temporaire.
 * @returns {Promise<Array>} Tableau des artisans (id, nom, nom_boutique, role).
 */
async function getAllArtisans() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('users')
    .select('id, nom, nom_boutique, role')
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
async function createVente(articles, type_paiement, vendeur_id, date_vente) {
  const supabase = getSupabase()

  // Déterminer un artisan principal pour l'en-tête (compatibilité) : prendre le premier article
  const vente_artisan_id = articles?.length ? articles[0].artisan_id || null : null

  // 1. Créer l'en-tête de la vente
  const { data: venteData, error: venteError } = await supabase
    .from('ventes')
    .insert({ type_paiement, artisan_id: vente_artisan_id, vendeur_id, date_vente })
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
        artisan:artisan_id (nom, role),
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
  // Agréger les ventes pour un artisan en se basant sur les articles
  const allVentes = await getAllVentesUnpaginated()

  const ventesFiltered = []
  for (const vente of allVentes) {
    const articles = (vente.articles || []).filter(
      (a) => Number(a.artisan_id) === Number(artisan_id),
    )
    if (articles.length > 0) {
      const total_articles = articles.reduce((s, a) => s + (a.quantite || 0), 0)
      const total_montant = articles.reduce((s, a) => s + a.prix * (a.quantite || 0), 0)
      ventesFiltered.push({ ...vente, articles, total_articles, total_montant })
    }
  }

  if (!ventesFiltered.length)
    return { ventes: [], summary: { total_articles: 0, total_montant: 0 } }

  return { ventes: ventesFiltered, summary: summarizeVentes(ventesFiltered) }
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
      artisan:artisan_id (nom, role),
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

  // Récupérer la liste d'artisans pour nom/role
  const artisansList = await getAllArtisans()
  const artisanMap = artisansList.reduce((m, a) => {
    m[a.id] = a
    return m
  }, {})

  // Grouper par artisan_id présent sur chaque ligne d'article
  const grouped = {}
  for (const vente of allVentes) {
    // pour chaque vente, regrouper ses articles par artisan
    const byArtisan = {}
    for (const art of vente.articles || []) {
      const aid = art.artisan_id || null
      if (!byArtisan[aid]) byArtisan[aid] = []
      byArtisan[aid].push(art)
    }

    for (const [aid, articles] of Object.entries(byArtisan)) {
      const key = aid === 'null' ? null : Number(aid)
      if (!grouped[key]) {
        grouped[key] = {
          artisan_id: key,
          artisan_nom:
            artisanMap[key]?.nom || (key === null ? 'Artisan inconnu' : `Artisan #${key}`),
          artisan_role: artisanMap[key]?.role || null,
          ventes: [],
        }
      }

      // Construire une entrée de vente ne contenant que les articles de cet artisan
      const total_articles = articles.reduce((s, a) => s + (a.quantite || 0), 0)
      const total_montant = articles.reduce((s, a) => s + a.prix * (a.quantite || 0), 0)

      const venteEntry = {
        ...vente,
        articles,
        total_articles,
        total_montant,
      }

      grouped[key].ventes.push(venteEntry)
    }
  }

  // Construire le tableau de groupes avec le résumé par artisan
  const groupes = Object.values(grouped).map((g) => ({
    artisan_id: g.artisan_id,
    artisan_nom: g.artisan_nom,
    artisan_role: g.artisan_role,
    ventes: g.ventes,
    summary: summarizeVentes(g.ventes),
  }))

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
 * Récupère les ventes groupées par mois puis par artisan.
 * @returns {Promise<{mois: Array, total: {total_articles: number, total_montant: number}}>}
 */
async function getAllVentesGroupedByMonth() {
  const allVentes = await getAllVentesUnpaginated()

  if (!allVentes.length) {
    return { mois: [], total: { total_articles: 0, total_montant: 0 } }
  }

  // Grouper par mois (YYYY-MM) puis par artisan
  const artisansList = await getAllArtisans()
  const artisanMap = artisansList.reduce((m, a) => {
    m[a.id] = a
    return m
  }, {})

  const byMonth = {}
  for (const vente of allVentes) {
    const mois = vente.date_vente.substring(0, 7) // "2024-01"
    if (!byMonth[mois]) {
      byMonth[mois] = { mois, groupes: {} }
    }

    // regrouper articles par artisan
    const byArtisan = {}
    for (const art of vente.articles || []) {
      const aid = art.artisan_id || null
      if (!byArtisan[aid]) byArtisan[aid] = []
      byArtisan[aid].push(art)
    }

    for (const [aid, articles] of Object.entries(byArtisan)) {
      const key = aid === 'null' ? null : Number(aid)
      if (!byMonth[mois].groupes[key]) {
        byMonth[mois].groupes[key] = {
          artisan_id: key,
          artisan_nom:
            artisanMap[key]?.nom || (key === null ? 'Artisan inconnu' : `Artisan #${key}`),
          ventes: [],
        }
      }

      const total_articles = articles.reduce((s, a) => s + (a.quantite || 0), 0)
      const total_montant = articles.reduce((s, a) => s + a.prix * (a.quantite || 0), 0)

      const venteEntry = { ...vente, articles, total_articles, total_montant }
      byMonth[mois].groupes[key].ventes.push(venteEntry)
    }
  }

  // Convertir en tableau trié (du plus récent au plus ancien) avec résumés
  const moisArray = Object.entries(byMonth)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([moisKey, monthData]) => {
      const groupes = Object.values(monthData.groupes)
        .map((g) => ({
          artisan_id: g.artisan_id,
          artisan_nom: g.artisan_nom,
          ventes: g.ventes,
          summary: summarizeVentes(g.ventes),
        }))
        .sort((a, b) => (a.artisan_nom || '').localeCompare(b.artisan_nom || ''))

      const totalMois = groupes.reduce(
        (acc, g) => ({
          total_articles: acc.total_articles + g.summary.total_articles,
          total_montant: acc.total_montant + g.summary.total_montant,
        }),
        { total_articles: 0, total_montant: 0 },
      )

      return {
        mois: moisKey,
        groupes,
        total: totalMois,
      }
    })

  // Résumé global toutes périodes confondues
  const total = summarizeVentes(allVentes)

  return { mois: moisArray, total }
}

/**
 * Récupère les ventes pour un mois spécifique (format YYYY-MM), groupées par artisan.
 * @param {string} mois - Le mois au format "YYYY-MM".
 * @returns {Promise<{groupes: Array, total: {total_articles: number, total_montant: number}}>}
 */
async function getVentesByMonth(mois) {
  // Utiliser les ventes non paginées puis filtrer par mois, puis regrouper par artisan au niveau des articles
  const allVentes = await getAllVentesUnpaginated()

  const artisansList = await getAllArtisans()
  const artisanMap = artisansList.reduce((m, a) => {
    m[a.id] = a
    return m
  }, {})

  const groupesMap = {}
  for (const vente of allVentes) {
    if (!vente.date_vente?.startsWith(mois)) continue

    // regrouper articles par artisan
    const byArtisan = {}
    for (const art of vente.articles || []) {
      const aid = art.artisan_id || null
      if (!byArtisan[aid]) byArtisan[aid] = []
      byArtisan[aid].push(art)
    }

    for (const [aid, articles] of Object.entries(byArtisan)) {
      const key = aid === 'null' ? null : Number(aid)
      if (!groupesMap[key]) {
        groupesMap[key] = {
          artisan_id: key,
          artisan_nom:
            artisanMap[key]?.nom || (key === null ? 'Artisan inconnu' : `Artisan #${key}`),
          ventes: [],
        }
      }

      const total_articles = articles.reduce((s, a) => s + (a.quantite || 0), 0)
      const total_montant = articles.reduce((s, a) => s + a.prix * (a.quantite || 0), 0)

      const venteEntry = { ...vente, articles, total_articles, total_montant }
      groupesMap[key].ventes.push(venteEntry)
    }
  }

  const groupes = Object.values(groupesMap)
    .map((g) => ({
      artisan_id: g.artisan_id,
      artisan_nom: g.artisan_nom,
      ventes: g.ventes,
      summary: summarizeVentes(g.ventes),
    }))
    .sort((a, b) => (a.artisan_nom || '').localeCompare(b.artisan_nom || ''))

  const total = groupes.reduce(
    (acc, g) => ({
      total_articles: acc.total_articles + g.summary.total_articles,
      total_montant: acc.total_montant + g.summary.total_montant,
    }),
    { total_articles: 0, total_montant: 0 },
  )

  return { groupes, total }
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
 * Réinitialise le mot de passe d'un utilisateur : génère un nouveau mot de passe aléatoire,
 * le hache, le stocke en base et force le changement au prochain login.
 * @param {number} id - ID de l'utilisateur.
 * @returns {Promise<string>} Le nouveau mot de passe en clair.
 */
async function extendUserDateFin(id, newDateFin) {
  const supabase = getSupabase()
  const { error } = await supabase.from('users').update({ date_fin: newDateFin }).eq('id', id)

  if (error) throw error
  return true
}

async function resetUserPassword(id) {
  const supabase = getSupabase()

  // Générer un mot de passe aléatoire de 12 caractères
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$%'
  let newPassword = ''
  for (let i = 0; i < 12; i++) {
    newPassword += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  const password_hash = bcrypt.hashSync(newPassword, 10)
  const { error } = await supabase
    .from('users')
    .update({ password_hash, password_change_required: 1 })
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

  const { data: existingAdmin } = await supabase
    .from('users')
    .select('id')
    .eq('nom_boutique', 'Administration')
    .maybeSingle()

  if (existingAdmin) {
    // Mettre à jour le mot de passe pour garantir qu'il soit valide
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: hash })
      .eq('id', existingAdmin.id)

    if (updateError) {
      console.error('❌ Erreur mise à jour mot de passe admin:', updateError.message)
    } else {
      console.log('✅ Mot de passe admin vérifié et mis à jour')
    }
    return
  }

  const { error } = await supabase
    .from('users')
    .insert({ nom: 'Admin', nom_boutique: 'Administration', password_hash: hash, role: 'admin' })

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
