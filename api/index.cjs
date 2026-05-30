const express = require('express');
const cors = require('cors');
const path = require('path');
const { initTables } = require('./models.cjs');

// Import des contrôleurs
const { router: authRouter } = require('./authController.cjs');
const ventesRouter = require('./ventesController.cjs');
const rapportsRouter = require('./rapportsController.cjs');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Pour Vercel : servir le frontend buildé
app.use(express.static(path.join(__dirname, '..', 'dist')));

// Routes API
app.use('/api/auth', authRouter);
app.use('/api/ventes', ventesRouter);
app.use('/api/rapports', rapportsRouter);

// SPA fallback : rediriger toutes les autres routes vers index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

// Initialisation de la BDD et seed
initTables();

// Port pour le serveur local
const PORT = process.env.PORT || 3001;

// N'exporter l'app qu'une fois (évite les démarrages multiples en dev)
if (process.env.NODE_ENV !== 'production' && !module.parent) {
  app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
    console.log(`📦 API disponible sur http://localhost:${PORT}/api`);
  });
}

module.exports = app;