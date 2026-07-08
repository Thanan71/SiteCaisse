export const connectedUser = {
  id: 1,
  nom: 'Admin E2E',
  nom_boutique: 'Administration',
  role: 'admin',
}

const defaultArtisans = [
  {
    id: 1,
    nom: 'Marcel',
    nom_boutique: 'Atelier Marcel',
    role: 'permanent',
    est_actif: true,
    commission_cb_personnalisee: null,
  },
  {
    id: 2,
    nom: 'Emma',
    nom_boutique: 'Atelier Emma',
    role: 'temporaire',
    est_actif: true,
    commission_cb_personnalisee: 3,
  },
]

export async function installApiMock(page, options = {}) {
  const state = {
    loginSucceeds: options.loginSucceeds !== false,
    user: options.user || connectedUser,
    artisans: clone(options.artisans || defaultArtisans),
    users: clone(
      options.users || [
        {
          id: 1,
          nom: 'Admin E2E',
          nom_boutique: 'Administration',
          generated_password: '',
          role: 'admin',
          est_actif: true,
          date_fin: null,
          created_at: '2026-07-01T08:00:00.000Z',
          commission_cb_personnalisee: null,
        },
        ...defaultArtisans.map((artisan) => ({
          ...artisan,
          generated_password: 'password123',
          date_fin: artisan.role === 'temporaire' ? '2026-12-31' : null,
          created_at: '2026-07-01T09:00:00.000Z',
        })),
      ],
    ),
    ventes: clone(options.ventes || []),
    parametres: {
      commission_cb_permanent: '1.50',
      commission_cb_temporaire: '2.50',
      ...(options.parametres || {}),
    },
    logs: clone(
      options.logs || [
        {
          id: 1,
          created_at: '2026-07-08T10:00:00.000Z',
          user_nom: 'Admin E2E',
          user_nom_boutique: 'Administration',
          action: 'vente.create',
          cible_type: 'vente',
          cible_id: '1',
          details: { type_paiement: 'CB', articles: [{ article: 'Bol' }] },
        },
        {
          id: 2,
          created_at: '2026-07-08T09:00:00.000Z',
          user_nom: 'Admin E2E',
          user_nom_boutique: 'Administration',
          action: 'user.create',
          cible_type: 'user',
          cible_id: '2',
          details: { nom: 'Emma', nom_boutique: 'Atelier Emma' },
        },
      ],
    ),
  }

  state.ventes = state.ventes.map(normalizeVente)

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()
    const json = (body, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      })

    if (method === 'POST' && path === '/api/auth/login') {
      if (!state.loginSucceeds) {
        return json({ error: 'Nom de boutique ou mot de passe incorrect' }, 401)
      }

      return json({
        token: 'e2e-token',
        password_change_required: false,
        user: state.user,
      })
    }

    if (method === 'GET' && path === '/api/auth/me') {
      return json(state.user)
    }

    if (method === 'GET' && path === '/api/rapports/artisans') {
      return json(state.artisans)
    }

    if (method === 'GET' && path === '/api/rapports') {
      return json(createRapportGlobal(state))
    }

    if (method === 'GET' && path.startsWith('/api/rapports/mensuel/')) {
      const mois = path.split('/').at(-1)
      return json(createRapportGlobal(state, { mois }))
    }

    if (method === 'GET' && path.startsWith('/api/rapports/')) {
      const artisanId = Number(path.split('/').at(-1))
      return json(createRapportArtisan(state, artisanId))
    }

    if (method === 'GET' && path === '/api/ventes') {
      return json(createVentesList(state, url.searchParams))
    }

    if (method === 'POST' && path === '/api/ventes') {
      const payload = request.postDataJSON()
      const id = nextId(state.ventes)
      const vente = normalizeVente({
        id,
        type_paiement: payload.type_paiement,
        vendeur_id: state.user.id,
        vendeur_nom: state.user.nom,
        date_vente: payload.date_vente,
        created_at: '2026-07-08T12:00:00.000Z',
        articles: payload.articles.map((article, index) => ({
          id: index + 1,
          vente_id: id,
          ...article,
          artisan_id: Number(article.artisan_id),
          quantite: Number(article.quantite),
          prix: Number(article.prix),
        })),
      })
      state.ventes.unshift(vente)
      return json({ id, message: 'Vente créée avec succès' }, 201)
    }

    if (method === 'PUT' && path.startsWith('/api/ventes/')) {
      const id = Number(path.split('/').at(-1))
      const venteIndex = state.ventes.findIndex((vente) => vente.id === id)
      if (venteIndex < 0) return json({ error: 'Vente non trouvée' }, 404)

      const payload = request.postDataJSON()
      state.ventes[venteIndex] = normalizeVente({
        ...state.ventes[venteIndex],
        ...payload,
        articles: payload.articles || state.ventes[venteIndex].articles,
      })
      return json({ message: 'Vente modifiée avec succès' })
    }

    if (method === 'DELETE' && path.startsWith('/api/ventes/')) {
      const id = Number(path.split('/').at(-1))
      state.ventes = state.ventes.filter((vente) => vente.id !== id)
      return json({ message: 'Vente supprimée avec succès' })
    }

    if (method === 'GET' && path === '/api/admin/users') {
      return json(state.users)
    }

    if (method === 'POST' && path === '/api/admin/users') {
      const payload = request.postDataJSON()
      const id = nextId(state.users)
      const user = {
        id,
        generated_password: `${normalizePassword(payload.nom_boutique)}0042`,
        est_actif: true,
        created_at: '2026-07-08T12:00:00.000Z',
        commission_cb_personnalisee: null,
        ...payload,
      }
      state.users.unshift(user)
      if (user.role !== 'admin') {
        state.artisans.push({
          id,
          nom: user.nom,
          nom_boutique: user.nom_boutique,
          role: user.role,
          est_actif: user.est_actif,
          commission_cb_personnalisee: user.commission_cb_personnalisee,
        })
      }
      return json(
        { message: 'Utilisateur créé avec succès.', user, newPassword: user.generated_password },
        201,
      )
    }

    if (method === 'DELETE' && path.startsWith('/api/admin/users/')) {
      const id = Number(path.split('/').at(-1))
      const user = state.users.find((item) => item.id === id)
      if (user) user.est_actif = false
      const artisan = state.artisans.find((item) => item.id === id)
      if (artisan) artisan.est_actif = false
      return json({ message: 'Utilisateur désactivé avec succès' })
    }

    if (method === 'PATCH' && path.endsWith('/reactivate')) {
      const id = Number(path.split('/').at(-2))
      const user = state.users.find((item) => item.id === id)
      if (user) user.est_actif = true
      const artisan = state.artisans.find((item) => item.id === id)
      if (artisan) artisan.est_actif = true
      return json({ message: 'Utilisateur désarchivé avec succès', user })
    }

    if (method === 'PATCH' && path.endsWith('/commission')) {
      const id = Number(path.split('/').at(-2))
      const payload = request.postDataJSON()
      const commission =
        payload.commission_cb_personnalisee === null
          ? null
          : Number(payload.commission_cb_personnalisee)
      for (const collection of [state.users, state.artisans]) {
        const item = collection.find((entry) => entry.id === id)
        if (item) item.commission_cb_personnalisee = commission
      }
      return json({
        message: 'Commission personnalisée mise à jour avec succès',
        user: state.users.find((item) => item.id === id),
      })
    }

    if (method === 'PATCH' && path.endsWith('/extend')) {
      const id = Number(path.split('/').at(-2))
      const payload = request.postDataJSON()
      const user = state.users.find((item) => item.id === id)
      if (user) user.date_fin = payload.date_fin
      return json({ message: 'Accès prolongé avec succès', nouvelle_date_fin: payload.date_fin })
    }

    if (method === 'POST' && path.endsWith('/reset-password')) {
      const id = Number(path.split('/').at(-2))
      const user = state.users.find((item) => item.id === id)
      const newPassword = `${normalizePassword(user?.nom_boutique || 'boutique')}0099`
      if (user) {
        user.generated_password = newPassword
        user.password_change_required = true
      }
      return json({ message: 'Mot de passe réinitialisé avec succès.', newPassword })
    }

    if (method === 'GET' && path === '/api/admin/parametres') {
      return json(state.parametres)
    }

    if (method === 'PUT' && path.startsWith('/api/admin/parametres/')) {
      const cle = path.split('/').at(-1)
      state.parametres[cle] = request.postDataJSON().valeur
      return json({ message: 'Paramètre mis à jour avec succès' })
    }

    if (method === 'GET' && path === '/api/admin/logs') {
      return json(createLogsList(state, url.searchParams))
    }

    return json({ error: `Route mock non definie: ${method} ${path}` }, 404)
  })

  return state
}

export async function authenticate(page, user = connectedUser) {
  await page.addInitScript((currentUser) => {
    window.localStorage.setItem('token', 'e2e-token')
    window.localStorage.setItem('user', JSON.stringify(currentUser))
  }, user)
}

export async function loginThroughUi(page) {
  await page.goto('/login')
  await page.getByLabel('Nom de la boutique').fill('Administration')
  await page.getByLabel('Mot de passe').fill('password123')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.waitForURL('/')
}

function createVentesList(state, searchParams) {
  const dateDebut = searchParams.get('date_debut')
  const dateFin = searchParams.get('date_fin')
  const typePaiement = searchParams.get('type_paiement')
  const pageNumber = Number(searchParams.get('page') || 1)
  const limit = Number(searchParams.get('limit') || 10)
  const filteredVentes = state.ventes.filter((vente) => {
    if (dateDebut && vente.date_vente < dateDebut) return false
    if (dateFin && vente.date_vente > dateFin) return false
    if (typePaiement && vente.type_paiement !== typePaiement) return false
    return true
  })

  return {
    ventes: filteredVentes,
    pagination: {
      page: pageNumber,
      limit,
      total: filteredVentes.length,
      totalPages: filteredVentes.length ? Math.ceil(filteredVentes.length / limit) : 0,
    },
  }
}

function createRapportGlobal(state, { mois = null } = {}) {
  const ventes = mois
    ? state.ventes.filter((vente) => vente.date_vente?.startsWith(mois))
    : state.ventes
  const groupes = state.artisans
    .map((artisan) => {
      const rapport = createRapportArtisan({ ...state, ventes }, artisan.id)
      return {
        artisan_id: artisan.id,
        artisan_nom: artisan.nom_boutique || artisan.nom,
        artisan_role: artisan.role,
        commission_cb_personnalisee: artisan.commission_cb_personnalisee ?? null,
        ventes: rapport.ventes,
        summary: rapport.summary,
      }
    })
    .filter((groupe) => groupe.ventes.length > 0)

  const total = groupes.reduce(
    (summary, groupe) => ({
      total_articles: summary.total_articles + groupe.summary.total_articles,
      total_montant: summary.total_montant + groupe.summary.total_montant,
      total_cb: summary.total_cb + groupe.summary.total_cb,
      total_commission: summary.total_commission + groupe.summary.commission_cb,
    }),
    { total_articles: 0, total_montant: 0, total_cb: 0, total_commission: 0 },
  )

  return {
    groupes,
    total,
    parametres: {
      commission_cb_permanent: Number(state.parametres.commission_cb_permanent),
      commission_cb_temporaire: Number(state.parametres.commission_cb_temporaire),
    },
  }
}

function createRapportArtisan(state, artisanId) {
  const artisan = state.artisans.find((item) => Number(item.id) === Number(artisanId))
  const ventes = state.ventes
    .map((vente) => ({
      ...vente,
      articles: vente.articles.filter(
        (article) => Number(article.artisan_id) === Number(artisanId),
      ),
    }))
    .filter((vente) => vente.articles.length > 0)
    .map(normalizeVente)

  const summary = ventes.reduce(
    (result, vente) => ({
      total_articles: result.total_articles + vente.total_articles,
      total_montant: result.total_montant + vente.total_montant,
      total_cb: result.total_cb + (vente.type_paiement === 'CB' ? vente.total_montant : 0),
      commission_cb: 0,
      taux_commission: result.taux_commission,
      commission_personnalisee: result.commission_personnalisee,
    }),
    {
      total_articles: 0,
      total_montant: 0,
      total_cb: 0,
      commission_cb: 0,
      taux_commission: getCommissionRate(state, artisan),
      commission_personnalisee: artisan?.commission_cb_personnalisee !== null,
    },
  )
  summary.commission_cb = Math.round(summary.total_cb * summary.taux_commission) / 100

  return { ventes, summary }
}

function createLogsList(state, searchParams) {
  const action = searchParams.get('action')
  const cibleType = searchParams.get('cible_type')
  const page = Number(searchParams.get('page') || 1)
  const limit = Number(searchParams.get('limit') || 25)
  const logs = state.logs.filter((log) => {
    if (action && log.action !== action) return false
    if (cibleType && log.cible_type !== cibleType) return false
    return true
  })

  return {
    logs,
    pagination: {
      page,
      limit,
      total: logs.length,
      totalPages: logs.length ? Math.ceil(logs.length / limit) : 0,
    },
  }
}

function normalizeVente(vente) {
  const articles = (vente.articles || []).map((article) => ({
    ...article,
    artisan_id: Number(article.artisan_id),
    quantite: Number(article.quantite),
    prix: Number(article.prix),
  }))
  return {
    ...vente,
    articles,
    total_articles: articles.reduce((total, article) => total + article.quantite, 0),
    total_montant: articles.reduce((total, article) => total + article.prix * article.quantite, 0),
  }
}

function getCommissionRate(state, artisan) {
  if (
    artisan?.commission_cb_personnalisee !== null &&
    artisan?.commission_cb_personnalisee !== undefined
  ) {
    return Number(artisan.commission_cb_personnalisee)
  }
  return Number(
    artisan?.role === 'temporaire'
      ? state.parametres.commission_cb_temporaire
      : state.parametres.commission_cb_permanent,
  )
}

function normalizePassword(value) {
  return String(value || 'boutique')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function nextId(items) {
  return items.reduce((maxId, item) => Math.max(maxId, Number(item.id) || 0), 0) + 1
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}
