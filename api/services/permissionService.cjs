'use strict'

function isAdminRole(role) {
  return role === 'admin' || role === 'dev'
}

// Ces contrôles utilisent le rôle courant chargé en base par authMiddleware.
function requireAdmin(req, res, next) {
  if (!isAdminRole(req.user?.role)) {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs' })
  }
  next()
}

function requireDev(req, res, next) {
  if (req.user?.role !== 'dev') {
    return res.status(403).json({ error: 'Accès réservé aux développeurs' })
  }
  next()
}

module.exports = { isAdminRole, requireAdmin, requireDev }
