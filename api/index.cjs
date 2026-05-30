const express = require('express');
const cors = require('cors');

// Import des contrôleurs
const { router: authRouter } = require('./authController.cjs');
const ventesRouter = require('./ventesController.cjs');
const rapportsRouter = require('./rapportsController.cjs');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes API
app.use('/api/auth', authRouter);
app.use('/api/ventes', ventesRouter);
app.use('/api/rapports', rapportsRouter);

// Pour Vercel : exporter l'app directement en Serverless Function
module.exports = app;

// Pour le développement local
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
    console.log(`📦 API disponible sur http://localhost:${PORT}/api`);
  });
}