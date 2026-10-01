const express = require('express')
const { authMiddleware } = require('./authController.cjs')
const { requireDev } = require('./services/permissionService.cjs')
const {
  SuggestionError,
  createSuggestion,
  listSuggestions,
  listOwnSuggestions,
  updateSuggestionStatus,
} = require('./services/suggestionService.cjs')
const { logAction, logError } = require('./services/loggerService.cjs')

const router = express.Router()
router.use(authMiddleware)

async function handleError(err, req, res, context) {
  if (err instanceof SuggestionError) {
    return res.status(err.statusCode).json({ error: err.message })
  }
  // Les erreurs PostgreSQL peuvent contenir le texte soumis. Les logs sont visibles aux admins.
  await logError({
    user: req.user,
    err: new Error('Erreur de stockage des suggestions'),
    context,
    cible_type: 'suggestion',
    req: {
      method: req.method,
      originalUrl: '/api/suggestions',
      headers: {},
    },
  })
  return res.status(500).json({ error: 'Erreur serveur' })
}

router.post('/', async (req, res) => {
  try {
    const suggestion = await createSuggestion(req.body, req.user)
    await logAction({
      user: req.user,
      action: 'suggestion.create',
      cible_type: 'suggestion',
      cible_id: suggestion.id,
      details: { statut: suggestion.statut },
    })
    return res.status(201).json({ suggestion })
  } catch (err) {
    return handleError(err, req, res, 'suggestions.create')
  }
})

router.get('/mes', async (req, res) => {
  try {
    return res.json(await listOwnSuggestions(req.user.id, req.query))
  } catch (err) {
    return handleError(err, req, res, 'suggestions.list_own')
  }
})

router.get('/', requireDev, async (req, res) => {
  try {
    return res.json(await listSuggestions(req.query))
  } catch (err) {
    return handleError(err, req, res, 'suggestions.list')
  }
})

router.patch('/:id/statut', requireDev, async (req, res) => {
  try {
    const suggestion = await updateSuggestionStatus(req.params.id, req.body?.statut)
    await logAction({
      user: req.user,
      action: 'suggestion.update_status',
      cible_type: 'suggestion',
      cible_id: suggestion.id,
      details: { statut: suggestion.statut },
    })
    return res.json({ suggestion })
  } catch (err) {
    return handleError(err, req, res, 'suggestions.update_status')
  }
})

module.exports = router
